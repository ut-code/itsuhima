import { describe, expect, test } from "vitest";
import { type Browser, createBrowser, createEvent, slotOnNov2, submissionInput } from "./helpers.js";

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

async function listHistory(browser: Browser, eventId: string) {
  const res = await browser.get(`/events/${eventId}/history`);
  expect(res.status).toBe(200);
  return (await res.json()) as HistoryEntry[];
}

// biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを検証するため
async function getEvent(browser: Browser, eventId: string): Promise<any> {
  const res = await browser.get(`/events/${eventId}`);
  expect(res.status).toBe(200);
  return res.json();
}

/** ゲストとして回答し、その参加者の id を返す */
async function submit(guest: Browser, eventId: string, optionId: string, overrides: Record<string, unknown> = {}) {
  const res = await guest.post(`/events/${eventId}/submissions`, submissionInput(optionId, overrides));
  expect(res.status).toBe(201);
  return ((await res.json()) as { guest: { id: string } }).guest.id;
}

const slotOnNov3 = { startAt: "2026-11-03T01:00:00.000Z", endAt: "2026-11-03T03:00:00.000Z" };

describe("イベントの設定の履歴", () => {
  test("設定を変えると、変える前の設定が残る。戻せるのはホストだけ", async () => {
    const host = createBrowser();
    const { id, input } = await createEvent(host, { name: "定例会" });

    expect((await host.patch(`/events/${id}`, { name: "打ち上げ", description: "新しい説明" })).status).toBe(200);

    const history = await listHistory(host, id);
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
    expect(await listHistory(createBrowser(), id)).toEqual([expect.objectContaining({ canRestore: false })]);
  });

  test("何も変わらなければ残さない", async () => {
    const host = createBrowser();
    const { id, input } = await createEvent(host);

    const { name, description, startDate, endDate, allowedRanges, options } = input;
    const res = await host.patch(`/events/${id}`, {
      name,
      description,
      startDate,
      endDate,
      allowedRanges,
      options: [...options].reverse(),
    });

    expect(res.status).toBe(200);
    expect(await listHistory(host, id)).toEqual([]);
  });

  test("戻すと、変える前の設定になり、戻す前の設定も履歴に残る", async () => {
    const host = createBrowser();
    const { id, input } = await createEvent(host, { name: "定例会" });
    const newOption = { id: crypto.randomUUID(), label: "オンライン", color: "#FF0000" };
    await host.patch(`/events/${id}`, {
      name: "打ち上げ",
      endDate: "2026-11-05",
      allowedRanges: [{ startTime: "10:00", endTime: "12:00" }],
      options: [...input.options, newOption],
    });
    const [entry] = await listHistory(host, id);

    const res = await host.post(`/events/${id}/history/${entry.id}/restore`);

    expect(res.status).toBe(204);
    const event = await getEvent(host, id);
    expect(event).toMatchObject({
      name: "定例会",
      endDate: "2026-11-04",
      allowedRanges: [expect.objectContaining({ startTime: "08:00", endTime: "23:00" })],
      options: input.options.map((o) => expect.objectContaining(o)),
    });
    expect(event.options).toHaveLength(1);
    const history = await listHistory(host, id);
    expect(history).toHaveLength(2);
    expect(history[0].before).toMatchObject({ name: "打ち上げ", endDate: "2026-11-05" });
  });

  test("ホスト以外は戻せない (403)", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { name: "定例会" });
    await host.patch(`/events/${id}`, { name: "打ち上げ" });
    const [entry] = await listHistory(host, id);

    const res = await createBrowser().post(`/events/${id}/history/${entry.id}/restore`);

    expect(res.status).toBe(403);
    expect((await getEvent(host, id)).name).toBe("打ち上げ");
  });

  test("戻すと Slot が紐づく参加形態が消える場合は、戻せない (400)", async () => {
    const host = createBrowser();
    const { id, input } = await createEvent(host);
    const newOption = { id: crypto.randomUUID(), label: "オンライン", color: "#FF0000" };
    await host.patch(`/events/${id}`, { options: [...input.options, newOption] });
    await submit(createBrowser(), id, newOption.id);
    const [entry] = await listHistory(host, id);

    const res = await host.post(`/events/${id}/history/${entry.id}/restore`);

    expect(res.status).toBe(400);
  });
});

describe("回答の履歴", () => {
  test("回答を変えると、変える前の回答が残る。戻せるのは本人だけ", async () => {
    const host = createBrowser();
    const guest = createBrowser();
    const { id, optionId } = await createEvent(host);
    const guestId = await submit(guest, id, optionId, { name: "太郎", comment: "よろしく" });

    const res = await guest.put(
      `/events/${id}/submissions/mine`,
      submissionInput(optionId, { name: "次郎", comment: null, slots: [{ ...slotOnNov3, optionId }] }),
    );
    expect(res.status).toBe(200);

    expect(await listHistory(guest, id)).toEqual([
      {
        id: expect.any(String),
        target: "participant",
        targetId: guestId,
        action: "update",
        before: { name: "太郎", comment: "よろしく", slots: [{ ...slotOnNov2, optionId }] },
        createdAt: expect.any(String),
        canRestore: true,
      },
    ]);
    expect(await listHistory(host, id)).toEqual([expect.objectContaining({ canRestore: false })]);
  });

  test("何も変わらなければ残さない", async () => {
    const guest = createBrowser();
    const { id, optionId } = await createEvent(createBrowser());
    await submit(guest, id, optionId);

    expect((await guest.put(`/events/${id}/submissions/mine`, submissionInput(optionId))).status).toBe(200);

    expect(await listHistory(guest, id)).toEqual([]);
  });

  test("本人は戻せる。ほかの人は 403", async () => {
    const guest = createBrowser();
    const { id, optionId } = await createEvent(createBrowser());
    await submit(guest, id, optionId, { name: "太郎" });
    await guest.put(
      `/events/${id}/submissions/mine`,
      submissionInput(optionId, { name: "次郎", slots: [{ ...slotOnNov3, optionId }] }),
    );
    const [entry] = await listHistory(guest, id);

    const denied = await createBrowser().post(`/events/${id}/history/${entry.id}/restore`);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ message: "この回答を戻す権限がありません。" });

    const res = await guest.post(`/events/${id}/history/${entry.id}/restore`);
    expect(res.status).toBe(204);
    const event = await getEvent(guest, id);
    expect(event.meAsGuest).toMatchObject({ name: "太郎", slots: [expect.objectContaining(slotOnNov2)] });
    expect(event.meAsGuest.slots).toHaveLength(1);
    expect(await listHistory(guest, id)).toHaveLength(2);
  });
});

describe("履歴の一覧と、戻す操作", () => {
  test("新しい順に返す", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { name: "1" });
    await host.patch(`/events/${id}`, { name: "2" });
    await host.patch(`/events/${id}`, { name: "3" });

    const history = await listHistory(host, id);

    expect(history.map((h) => h.before.name)).toEqual(["2", "1"]);
  });

  test("削除したイベントは 410", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { name: "定例会" });
    await host.patch(`/events/${id}`, { name: "打ち上げ" });
    const [entry] = await listHistory(host, id);
    await host.delete(`/events/${id}`);

    expect((await host.get(`/events/${id}/history`)).status).toBe(410);
    expect((await host.post(`/events/${id}/history/${entry.id}/restore`)).status).toBe(410);
  });

  test("存在しないイベントは 404", async () => {
    expect((await createBrowser().get(`/events/${"a".repeat(21)}/history`)).status).toBe(404);
  });

  test("ほかのイベントの履歴は戻せない (404)", async () => {
    const host = createBrowser();
    const a = await createEvent(host, { name: "A" });
    const b = await createEvent(host);
    await host.patch(`/events/${a.id}`, { name: "A'" });
    const [entry] = await listHistory(host, a.id);

    const res = await host.post(`/events/${b.id}/history/${entry.id}/restore`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "履歴が見つかりません。" });
  });
});
