import { describe, expect, test } from "vitest";
import { api, createEvent, slotOnNov2, submissionInput, submit } from "./helpers.js";

type HistoryEntry = {
  id: string;
  target: "event" | "participant";
  targetId: string;
  action: "update" | "delete";
  // biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを検証するため
  before: any;
  createdAt: string;
  canRestore: boolean;
};

async function listHistory(eventId: string) {
  const res = await api.get(`/events/${eventId}/history`);
  expect(res.status).toBe(200);
  return (await res.json()) as HistoryEntry[];
}

// biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを検証するため
async function getEvent(eventId: string): Promise<any> {
  const res = await api.get(`/events/${eventId}`);
  expect(res.status).toBe(200);
  return res.json();
}

const slotOnNov3 = { startAt: "2026-11-03T01:00:00.000Z", endAt: "2026-11-03T03:00:00.000Z" };

describe("イベントの設定の履歴", () => {
  test("設定を変えると、変える前の設定が残り、誰でも戻せる", async () => {
    const { id, input } = await createEvent({ name: "定例会" });

    expect((await api.patch(`/events/${id}`, { name: "打ち上げ", description: "新しい説明" })).status).toBe(200);

    const history = await listHistory(id);
    expect(history).toEqual([
      {
        id: expect.any(String),
        target: "event",
        targetId: id,
        action: "update",
        before: {
          name: "定例会",
          description: "説明",
          startDate: "2026-11-02",
          endDate: "2026-11-04",
          allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
          options: input.options,
        },
        createdAt: expect.any(String),
        canRestore: true,
      },
    ]);
  });

  test("何も変わらなければ残さない", async () => {
    const { id, input } = await createEvent();

    const { name, description, startDate, endDate, allowedRanges, options } = input;
    const res = await api.patch(`/events/${id}`, {
      name,
      description,
      startDate,
      endDate,
      allowedRanges,
      options: [...options].reverse(),
    });

    expect(res.status).toBe(200);
    expect(await listHistory(id)).toEqual([]);
  });

  test("戻すと、変える前の設定になり、戻す前の設定も履歴に残る", async () => {
    const { id, input } = await createEvent({ name: "定例会" });
    const newOption = { id: crypto.randomUUID(), label: "オンライン", color: "#FF0000" };
    await api.patch(`/events/${id}`, {
      name: "打ち上げ",
      endDate: "2026-11-05",
      allowedRanges: [{ startTime: "10:00", endTime: "12:00" }],
      options: [...input.options, newOption],
    });
    const [entry] = await listHistory(id);

    const res = await api.post(`/events/${id}/history/${entry.id}/restore`);

    expect(res.status).toBe(204);
    const event = await getEvent(id);
    expect(event).toMatchObject({
      name: "定例会",
      endDate: "2026-11-04",
      allowedRanges: [expect.objectContaining({ startTime: "08:00", endTime: "23:00" })],
      options: input.options.map((o) => expect.objectContaining(o)),
    });
    expect(event.options).toHaveLength(1);
    const history = await listHistory(id);
    expect(history).toHaveLength(2);
    expect(history[0].before).toMatchObject({ name: "打ち上げ", endDate: "2026-11-05" });
  });

  test("戻すと Slot が紐づく参加形態が消える場合は、戻せない (400)", async () => {
    const { id, input } = await createEvent();
    const newOption = { id: crypto.randomUUID(), label: "オンライン", color: "#FF0000" };
    await api.patch(`/events/${id}`, { options: [...input.options, newOption] });
    await submit(id, newOption.id);
    const [entry] = await listHistory(id);

    const res = await api.post(`/events/${id}/history/${entry.id}/restore`);

    expect(res.status).toBe(400);
  });
});

describe("回答の履歴", () => {
  test("回答を変えると、変える前の回答が残り、誰でも戻せる", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId, { name: "太郎", comment: "よろしく" });

    const res = await api.put(
      `/events/${id}/participants/${participantId}`,
      submissionInput(optionId, { name: "次郎", comment: null, slots: [{ ...slotOnNov3, optionId }] }),
    );
    expect(res.status).toBe(200);

    expect(await listHistory(id)).toEqual([
      {
        id: expect.any(String),
        target: "participant",
        targetId: participantId,
        action: "update",
        before: { name: "太郎", comment: "よろしく", slots: [{ ...slotOnNov2, optionId }] },
        createdAt: expect.any(String),
        canRestore: true,
      },
    ]);
  });

  test("何も変わらなければ残さない", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId);

    expect((await api.put(`/events/${id}/participants/${participantId}`, submissionInput(optionId))).status).toBe(200);

    expect(await listHistory(id)).toEqual([]);
  });

  test("戻すと、変える前の回答になる", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId, { name: "太郎" });
    await api.put(
      `/events/${id}/participants/${participantId}`,
      submissionInput(optionId, { name: "次郎", slots: [{ ...slotOnNov3, optionId }] }),
    );
    const [entry] = await listHistory(id);

    const res = await api.post(`/events/${id}/history/${entry.id}/restore`);
    expect(res.status).toBe(204);
    const { participants } = await getEvent(id);
    expect(participants).toEqual([
      expect.objectContaining({ id: participantId, name: "太郎", slots: [expect.objectContaining(slotOnNov2)] }),
    ]);
    expect(await listHistory(id)).toHaveLength(2);
  });

  test("消した回答は、消す前の回答が残り、戻すと同じ id で作り直す", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId, { name: "太郎", comment: "よろしく" });
    expect((await api.delete(`/events/${id}/participants/${participantId}`)).status).toBe(204);

    const [entry] = await listHistory(id);
    expect(entry).toMatchObject({
      target: "participant",
      targetId: participantId,
      action: "delete",
      before: { name: "太郎", comment: "よろしく", slots: [{ ...slotOnNov2, optionId }] },
      canRestore: true,
    });

    const res = await api.post(`/events/${id}/history/${entry.id}/restore`);

    expect(res.status).toBe(204);
    expect((await getEvent(id)).participants).toEqual([
      expect.objectContaining({
        id: participantId,
        name: "太郎",
        comment: "よろしく",
        slots: [expect.objectContaining(slotOnNov2)],
      }),
    ]);
  });

  test("消した回答の、消す前の変更の履歴から戻しても、作り直す", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId, { name: "太郎" });
    await api.put(`/events/${id}/participants/${participantId}`, submissionInput(optionId, { name: "次郎" }));
    await api.delete(`/events/${id}/participants/${participantId}`);
    const update = (await listHistory(id)).find((h) => h.action === "update");

    const res = await api.post(`/events/${id}/history/${update?.id}/restore`);

    expect(res.status).toBe(204);
    expect((await getEvent(id)).participants).toEqual([expect.objectContaining({ id: participantId, name: "太郎" })]);
  });

  test("作り直す回答の参加形態が、もう無ければ戻せない (400)", async () => {
    const { id, input } = await createEvent();
    const newOption = { id: crypto.randomUUID(), label: "オンライン", color: "#FF0000" };
    await api.patch(`/events/${id}`, { options: [...input.options, newOption] });
    const participantId = await submit(id, newOption.id);
    await api.delete(`/events/${id}/participants/${participantId}`);
    await api.patch(`/events/${id}`, { options: input.options });
    const entry = (await listHistory(id)).find((h) => h.target === "participant");

    const res = await api.post(`/events/${id}/history/${entry?.id}/restore`);

    expect(res.status).toBe(400);
    expect((await getEvent(id)).participants).toEqual([]);
  });
});

describe("履歴の一覧と、戻す操作", () => {
  test("新しい順に返す", async () => {
    const { id } = await createEvent({ name: "1" });
    await api.patch(`/events/${id}`, { name: "2" });
    await api.patch(`/events/${id}`, { name: "3" });

    const history = await listHistory(id);

    expect(history.map((h) => h.before.name)).toEqual(["2", "1"]);
  });

  test("削除したイベントは 410", async () => {
    const { id } = await createEvent({ name: "定例会" });
    await api.patch(`/events/${id}`, { name: "打ち上げ" });
    const [entry] = await listHistory(id);
    await api.delete(`/events/${id}`);

    expect((await api.get(`/events/${id}/history`)).status).toBe(410);
    expect((await api.post(`/events/${id}/history/${entry.id}/restore`)).status).toBe(410);
  });

  test("存在しないイベントは 404", async () => {
    expect((await api.get(`/events/${"a".repeat(21)}/history`)).status).toBe(404);
  });

  test("ほかのイベントの履歴は戻せない (404)", async () => {
    const a = await createEvent({ name: "A" });
    const b = await createEvent();
    await api.patch(`/events/${a.id}`, { name: "A'" });
    const [entry] = await listHistory(a.id);

    const res = await api.post(`/events/${b.id}/history/${entry.id}/restore`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "履歴が見つかりません。" });
  });
});
