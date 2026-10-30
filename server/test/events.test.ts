import { describe, expect, test } from "vitest";
import { api, createEvent, eventInput, slotOnNov2, submissionInput, submit } from "./helpers.js";

const missingEventId = "a".repeat(21);

async function getEvent(eventId: string) {
  const res = await api.get(`/events/${eventId}`);
  expect(res.status).toBe(200);
  // biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを検証するため
  return (await res.json()) as any;
}

/** 回答を id で探す */
// biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを検証するため
async function getParticipant(eventId: string, participantId: string): Promise<any> {
  const event = await getEvent(eventId);
  return event.participants.find((p: { id: string }) => p.id === participantId);
}

describe("POST /events", () => {
  test("作成すると 201 で id と name を返す。回答は無く、誰でも編集できる", async () => {
    const input = eventInput({ description: "  説明  " });

    const res = await api.post("/events", input);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string };
    expect(body).toEqual({ id: expect.stringMatching(/^[0-9A-Za-z]{21}$/), name: "テストイベント" });

    const event = await getEvent(body.id);
    expect(event).toEqual({
      id: body.id,
      name: "テストイベント",
      description: "説明",
      startDate: "2026-11-02",
      endDate: "2026-11-04",
      timezone: "Asia/Tokyo",
      allowedRanges: [
        {
          id: expect.any(String),
          eventId: body.id,
          startTime: "08:00",
          endTime: "23:00",
        },
      ],
      options: [{ ...input.options[0], eventId: body.id }],
      participants: [],
      canEdit: true,
      hasOwner: false,
    });
  });

  test("空白だけの説明は空文字として返す", async () => {
    const { id } = await createEvent({ description: "   " });

    expect((await getEvent(id)).description).toBe("");
  });

  test("名前が空なら 400", async () => {
    const res = await api.post("/events", eventInput({ name: "" }));

    expect(res.status).toBe(400);
  });

  test("開始日が終了日より後なら 400", async () => {
    const res = await api.post("/events", eventInput({ startDate: "2026-11-06", endDate: "2026-11-04" }));

    expect(res.status).toBe(400);
  });

  test("参加形態が 0 件なら 400", async () => {
    const res = await api.post("/events", eventInput({ options: [] }));

    expect(res.status).toBe(400);
  });

  test("日付が YYYY-MM-DD の形式でなければ 400", async () => {
    const res = await api.post("/events", eventInput({ startDate: "2026-11-01T15:00:00.000Z" }));

    expect(res.status).toBe(400);
  });

  test("時間帯が HH:mm の形式でなければ 400", async () => {
    const res = await api.post(
      "/events",
      eventInput({ allowedRanges: [{ startTime: "2026-11-01T23:00:00.000Z", endTime: "2026-11-04T14:00:00.000Z" }] }),
    );

    expect(res.status).toBe(400);
  });

  test("時間帯が 15 分単位でなければ 400", async () => {
    const res = await api.post("/events", eventInput({ allowedRanges: [{ startTime: "08:10", endTime: "23:00" }] }));

    expect(res.status).toBe(400);
  });

  test("時間帯の開始が終了より後なら 400", async () => {
    const res = await api.post("/events", eventInput({ allowedRanges: [{ startTime: "23:00", endTime: "08:00" }] }));

    expect(res.status).toBe(400);
  });

  test("時間帯の終了は 24:00 にできる", async () => {
    const { id } = await createEvent({ allowedRanges: [{ startTime: "00:00", endTime: "24:00" }] });

    expect((await getEvent(id)).allowedRanges).toMatchObject([{ startTime: "00:00", endTime: "24:00" }]);
  });

  test("24:00 より後の時刻は 400", async () => {
    const res = await api.post("/events", eventInput({ allowedRanges: [{ startTime: "08:00", endTime: "24:15" }] }));

    expect(res.status).toBe(400);
  });
});

describe("GET /events?ids=", () => {
  test("指定した id のイベントの、名前と日程と削除したかを返す。無い id は返さない", async () => {
    const a = await createEvent({ name: "A" });
    const b = await createEvent({ name: "B" });
    await createEvent({ name: "指定しない" });
    await api.delete(`/events/${b.id}`);

    const res = await api.get(`/events?ids=${a.id},${b.id},${missingEventId}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string }[];
    expect(body.sort((x, y) => x.name.localeCompare(y.name))).toEqual([
      { id: a.id, name: "A", startDate: "2026-11-02", endDate: "2026-11-04", timezone: "Asia/Tokyo", deleted: false },
      { id: b.id, name: "B", startDate: "2026-11-02", endDate: "2026-11-04", timezone: "Asia/Tokyo", deleted: true },
    ]);
  });

  test("空や、イベント ID の形でないものは無視する", async () => {
    const { id } = await createEvent();

    const res = await api.get(`/events?ids=,short,${id},${id}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([expect.objectContaining({ id })]);
    expect(await (await api.get("/events?ids=")).json()).toEqual([]);
  });

  test("101 件以上は 400", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => i.toString().padStart(21, "a"));

    const res = await api.get(`/events?ids=${ids.join(",")}`);

    expect(res.status).toBe(400);
  });
});

describe("GET /events/:eventId", () => {
  test("存在しなければ 404", async () => {
    const res = await api.get(`/events/${missingEventId}`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "イベントが見つかりません。" });
  });

  test("id が 21 文字でなければ 400", async () => {
    const res = await api.get("/events/short");

    expect(res.status).toBe(400);
  });

  test("回答を、id・名前・コメント・Slot と、編集できるかと一緒に返す", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId, { comment: "  よろしく  " });

    const event = await getEvent(id);

    expect(event.participants).toEqual([
      {
        id: participantId,
        name: "ゲスト",
        comment: "よろしく",
        eventId: id,
        slots: [
          {
            id: expect.any(String),
            startAt: slotOnNov2.startAt,
            endAt: slotOnNov2.endAt,
            eventId: id,
            participantId,
            optionId,
          },
        ],
        canEdit: true,
        canDelete: true,
        hasOwner: false,
        isMine: false,
      },
    ]);
  });

  test("Cookie を発行しない (visited を除く)", async () => {
    const { id } = await createEvent();

    const res = await api.get(`/events/${id}`, { headers: { Cookie: "visited=1" } });

    expect(res.headers.get("Set-Cookie")).toBeNull();
  });
});

describe("PATCH /events/:eventId", () => {
  test("存在しないイベントは 404", async () => {
    const res = await api.patch(`/events/${missingEventId}`, { name: "x" });

    expect(res.status).toBe(404);
  });

  test("時間帯が HH:mm の形式でなければ 400", async () => {
    const { id } = await createEvent();

    const res = await api.patch(`/events/${id}`, {
      allowedRanges: [{ startTime: "2026-11-10T00:00:00.000Z", endTime: "2026-11-10T09:00:00.000Z" }],
    });

    expect(res.status).toBe(400);
  });

  test("回答が無ければ、名前・説明・日程・時間帯を更新できる", async () => {
    const { id } = await createEvent();

    const res = await api.patch(`/events/${id}`, {
      name: "新しい名前",
      description: "  新しい説明  ",
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      allowedRanges: [{ startTime: "09:00", endTime: "18:00" }],
    });

    expect(res.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを検証するため
    const { event } = (await res.json()) as any;
    expect(event).toEqual({
      id,
      name: "新しい名前",
      description: "新しい説明",
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      allowedRanges: [
        {
          id: expect.any(String),
          eventId: id,
          startTime: "09:00",
          endTime: "18:00",
        },
      ],
      options: [{ id: expect.any(String), label: "参加", color: "#0F82B1", eventId: id }],
    });
  });

  test("回答があると、名前と説明だけ更新し、日程と時間帯は変えない", async () => {
    const { id, optionId } = await createEvent();
    await submit(id, optionId);

    const res = await api.patch(`/events/${id}`, {
      name: "新しい名前",
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      allowedRanges: [{ startTime: "09:00", endTime: "18:00" }],
    });

    expect(res.status).toBe(200);
    const event = await getEvent(id);
    expect(event).toMatchObject({
      name: "新しい名前",
      startDate: "2026-11-02",
      endDate: "2026-11-04",
      allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
    });
  });

  test("省略したフィールドは変えない", async () => {
    const { id } = await createEvent();

    const res = await api.patch(`/events/${id}`, { name: "新しい名前" });

    expect(res.status).toBe(200);
    expect(await getEvent(id)).toMatchObject({
      name: "新しい名前",
      description: "説明",
      startDate: "2026-11-02",
      endDate: "2026-11-04",
      allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
      options: [{ label: "参加" }],
    });
  });

  test("何も指定しなくても 200 で、何も変えない", async () => {
    const { id } = await createEvent();

    const res = await api.patch(`/events/${id}`, {});

    expect(res.status).toBe(200);
    expect(await getEvent(id)).toMatchObject({ name: "テストイベント", description: "説明" });
  });

  test("空文字の説明と空の時間帯を指定すると、消える", async () => {
    const { id } = await createEvent();

    await api.patch(`/events/${id}`, { description: "", allowedRanges: [] });

    expect(await getEvent(id)).toMatchObject({ description: "", allowedRanges: [] });
  });

  test("参加形態を追加・変更・削除できる", async () => {
    const { id } = await createEvent({
      options: [
        { id: crypto.randomUUID(), label: "参加", color: "#0F82B1" },
        { id: crypto.randomUUID(), label: "消す", color: "#000000" },
      ],
    });
    const [kept] = (await getEvent(id)).options.filter((o: { label: string }) => o.label === "参加");
    const added = { id: crypto.randomUUID(), label: "オンライン", color: "#FF0000" };

    const res = await api.patch(`/events/${id}`, {
      options: [{ id: kept.id, label: "対面", color: "#00FF00" }, added],
    });

    expect(res.status).toBe(200);
    const options = (await getEvent(id)).options;
    expect(options.sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label))).toEqual([
      { ...added, eventId: id },
      { id: kept.id, label: "対面", color: "#00FF00", eventId: id },
    ]);
  });

  test("Slot が紐づく参加形態は削除できない", async () => {
    const { id, optionId } = await createEvent();
    await submit(id, optionId);

    const res = await api.patch(`/events/${id}`, {
      options: [{ id: crypto.randomUUID(), label: "別", color: "#000000" }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "以下の参加形態は日程が登録されているため削除できません: 参加" });
    expect((await getEvent(id)).options).toHaveLength(1);
  });

  test("参加形態を 0 件にはできない", async () => {
    const { id } = await createEvent();

    const res = await api.patch(`/events/${id}`, { options: [] });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /events/:eventId", () => {
  test("存在しないイベントは 404", async () => {
    const res = await api.delete(`/events/${missingEventId}`);

    expect(res.status).toBe(404);
  });

  test("削除できる。204 で本文は無い", async () => {
    const { id, optionId } = await createEvent();
    await submit(id, optionId);

    const res = await api.delete(`/events/${id}`);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  test("削除したイベントは 410 で、名前と完全に消える日時だけを返す", async () => {
    const { id, optionId } = await createEvent();
    await submit(id, optionId);
    const before = Date.now();
    await api.delete(`/events/${id}`);

    const res = await api.get(`/events/${id}`);

    expect(res.status).toBe(410);
    const body = (await res.json()) as { deletedAt: string; purgeAt: string };
    expect(body).toEqual({
      message: "このイベントは削除されました。",
      id,
      name: "テストイベント",
      deletedAt: expect.any(String),
      purgeAt: expect.any(String),
      canRestore: true,
    });
    expect(new Date(body.deletedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(body.purgeAt).getTime() - new Date(body.deletedAt).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("もう一度削除しても 204 で、削除した日時は変わらない", async () => {
    const { id } = await createEvent();
    await api.delete(`/events/${id}`);
    const first = (await (await api.get(`/events/${id}`)).json()) as { deletedAt: string };

    const res = await api.delete(`/events/${id}`);

    expect(res.status).toBe(204);
    expect(await (await api.get(`/events/${id}`)).json()).toMatchObject({ deletedAt: first.deletedAt });
  });

  test("削除したイベントは、編集も回答もできない (410)", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId);
    await api.delete(`/events/${id}`);

    const responses = await Promise.all([
      api.patch(`/events/${id}`, { name: "新しい名前" }),
      api.post(`/events/${id}/participants`, submissionInput(optionId)),
      api.put(`/events/${id}/participants/${participantId}`, submissionInput(optionId)),
      api.delete(`/events/${id}/participants/${participantId}`),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(410);
      expect(await res.json()).toEqual({ message: "このイベントは削除されています。" });
    }
  });
});

describe("POST /events/:eventId/restore", () => {
  test("削除したイベントを、回答ごと戻せる。204 で本文は無い", async () => {
    const { id, optionId } = await createEvent();
    await submit(id, optionId);
    await api.delete(`/events/${id}`);

    const res = await api.post(`/events/${id}/restore`);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect((await getEvent(id)).participants).toHaveLength(1);
  });

  test("削除されていなければ、何もせず 204", async () => {
    const { id } = await createEvent();

    const res = await api.post(`/events/${id}/restore`);

    expect(res.status).toBe(204);
    await getEvent(id);
  });

  test("存在しないイベントは 404", async () => {
    const res = await api.post(`/events/${missingEventId}/restore`);

    expect(res.status).toBe(404);
  });
});

describe("POST /events/:eventId/participants", () => {
  test("回答すると 201 で、回答を返す", async () => {
    const { id, optionId } = await createEvent();

    const res = await api.post(`/events/${id}/participants`, submissionInput(optionId));

    expect(res.status).toBe(201);
    const { participant } = (await res.json()) as { participant: { id: string } };
    expect(participant).toMatchObject({ name: "ゲスト", comment: "コメント", canEdit: true });
    expect(await getParticipant(id, participant.id)).toEqual(participant);
  });

  test("空白だけのコメントは null になる", async () => {
    const { id, optionId } = await createEvent();

    const participantId = await submit(id, optionId, { comment: "  " });

    expect((await getParticipant(id, participantId)).comment).toBeNull();
  });

  test("同じ名前でも、別の回答として足す", async () => {
    const { id, optionId } = await createEvent();
    await submit(id, optionId);

    await submit(id, optionId);

    expect((await getEvent(id)).participants.map((p: { name: string }) => p.name)).toEqual(["ゲスト", "ゲスト"]);
  });

  test("名前が空なら 400", async () => {
    const { id, optionId } = await createEvent();

    const res = await api.post(`/events/${id}/participants`, submissionInput(optionId, { name: "" }));

    expect(res.status).toBe(400);
  });

  test("存在しないイベントに回答すると 404", async () => {
    const res = await api.post(
      `/events/${missingEventId}/participants`,
      submissionInput(crypto.randomUUID(), { slots: [] }),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "イベントが見つかりません。" });
  });
});

// 検証の中身は slots.test.ts で確かめる。ここでは、提出と更新で検証が効いていることだけを確かめる
describe("日程の提出・更新での Slot の検証", () => {
  test("イベントの期間外なら 400", async () => {
    const { id, optionId } = await createEvent();

    const res = await api.post(
      `/events/${id}/participants`,
      submissionInput(optionId, {
        // 11/01 10:00〜12:00
        slots: [{ startAt: "2026-11-01T01:00:00.000Z", endAt: "2026-11-01T03:00:00.000Z", optionId }],
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: expect.stringContaining("日程の範囲") });
  });

  test("別のイベントの参加形態なら 400", async () => {
    const { id } = await createEvent();
    const other = await createEvent();

    const res = await api.post(`/events/${id}/participants`, submissionInput(other.optionId));

    expect(res.status).toBe(400);
  });

  test("回答の更新でも検証し、弾いたときは元の回答を変えない", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId);

    const res = await api.put(
      `/events/${id}/participants/${participantId}`,
      submissionInput(optionId, {
        name: "新しい名前",
        // 11/01 10:00〜12:00
        slots: [{ startAt: "2026-11-01T01:00:00.000Z", endAt: "2026-11-01T03:00:00.000Z", optionId }],
      }),
    );

    expect(res.status).toBe(400);
    expect(await getParticipant(id, participantId)).toMatchObject({
      name: "ゲスト",
      slots: [{ startAt: slotOnNov2.startAt, endAt: slotOnNov2.endAt }],
    });
  });
});

describe("PUT /events/:eventId/participants/:participantId", () => {
  test("無い回答は 404", async () => {
    const { id, optionId } = await createEvent();

    const res = await api.put(`/events/${id}/participants/${crypto.randomUUID()}`, submissionInput(optionId));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "回答が見つかりません。" });
  });

  test("ほかのイベントの回答は 404", async () => {
    const a = await createEvent();
    const b = await createEvent();
    const participantId = await submit(a.id, a.optionId);

    const res = await api.put(`/events/${b.id}/participants/${participantId}`, submissionInput(b.optionId));

    expect(res.status).toBe(404);
  });

  test("名前・コメント・Slot を置き換える", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId);
    const newSlot = {
      startAt: "2026-11-03T05:00:00.000Z",
      endAt: "2026-11-03T06:00:00.000Z",
      optionId,
    };

    const res = await api.put(
      `/events/${id}/participants/${participantId}`,
      submissionInput(optionId, { name: "新しい名前", comment: "", slots: [newSlot] }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      participant: {
        id: participantId,
        name: "新しい名前",
        comment: null,
        eventId: id,
        slots: [
          {
            id: expect.any(String),
            startAt: newSlot.startAt,
            endAt: newSlot.endAt,
            eventId: id,
            participantId,
            optionId,
          },
        ],
        canEdit: true,
        canDelete: true,
        hasOwner: false,
        isMine: false,
      },
    });
    expect((await getParticipant(id, participantId)).slots).toEqual([
      expect.objectContaining({ startAt: newSlot.startAt, endAt: newSlot.endAt }),
    ]);
  });

  // D1 は 1 つの文のバインド変数が 100 個まで (Slot 1 行で 6 個)。ローカルの D1 はこの上限を強制しないので、
  // ここで確かめられるのは、分割した INSERT で全件が入ることまで
  test("1 つの文に収まらない数の Slot も保存できる", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId);
    // 11/02〜11/04 の 08:00〜23:00 を 1 時間ずつ、45 件
    const slots = [1, 2, 3].flatMap((day) =>
      Array.from({ length: 15 }, (_, hour) => {
        const start = new Date(Date.UTC(2026, 10, day, 23 + hour));
        return {
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
          optionId,
        };
      }),
    );

    const res = await api.put(`/events/${id}/participants/${participantId}`, submissionInput(optionId, { slots }));

    expect(res.status).toBe(200);
    expect((await getParticipant(id, participantId)).slots).toHaveLength(45);
  });

  test("ほかの回答は変えない", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId);
    const otherId = await submit(id, optionId, { name: "他の人" });

    await api.put(`/events/${id}/participants/${participantId}`, submissionInput(optionId, { slots: [] }));

    expect(await getParticipant(id, otherId)).toMatchObject({ name: "他の人", slots: [expect.anything()] });
  });
});

describe("DELETE /events/:eventId/participants/:participantId", () => {
  test("回答を Slot ごと消す。204 で本文は無い", async () => {
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId);
    const otherId = await submit(id, optionId, { name: "他の人" });

    const res = await api.delete(`/events/${id}/participants/${participantId}`);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect((await getEvent(id)).participants.map((p: { id: string }) => p.id)).toEqual([otherId]);
  });

  test("無い回答は 404", async () => {
    const { id } = await createEvent();

    const res = await api.delete(`/events/${id}/participants/${crypto.randomUUID()}`);

    expect(res.status).toBe(404);
  });
});
