import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { createDb } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { updateMyAvailability } from "../src/services/events.js";
import { type Browser, createBrowser, createEvent, eventInput, slotOnNov2, submissionInput } from "./helpers.js";

const missingEventId = "a".repeat(21);

async function getEvent(browser: Browser, eventId: string) {
  const res = await browser.get(`/events/${eventId}`);
  expect(res.status).toBe(200);
  // biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを検証するため
  return (await res.json()) as any;
}

async function submit(guest: Browser, eventId: string, optionId: string, overrides: Record<string, unknown> = {}) {
  const res = await guest.post(`/events/${eventId}/submissions`, submissionInput(optionId, overrides));
  expect(res.status).toBe(201);
}

describe("POST /events", () => {
  test("作成すると 201 で id と name を返し、作成者がホストになる", async () => {
    const host = createBrowser();
    const input = eventInput({ description: "  説明  " });

    const res = await host.post("/events", input);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string };
    expect(body).toEqual({ id: expect.stringMatching(/^[0-9A-Za-z]{21}$/), name: "テストイベント" });

    const event = await getEvent(host, body.id);
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
      hosts: [{ id: expect.any(String), eventId: body.id }],
      guests: [],
      isHost: true,
      meAsGuest: null,
    });
  });

  test("空白だけの説明は空文字として返す", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { description: "   " });

    expect((await getEvent(host, id)).description).toBe("");
  });

  test("名前が空なら 400", async () => {
    const res = await createBrowser().post("/events", eventInput({ name: "" }));

    expect(res.status).toBe(400);
  });

  test("開始日が終了日より後なら 400", async () => {
    const res = await createBrowser().post("/events", eventInput({ startDate: "2026-11-06", endDate: "2026-11-04" }));

    expect(res.status).toBe(400);
  });

  test("参加形態が 0 件なら 400", async () => {
    const res = await createBrowser().post("/events", eventInput({ options: [] }));

    expect(res.status).toBe(400);
  });

  test("日付が YYYY-MM-DD の形式でなければ 400", async () => {
    const res = await createBrowser().post("/events", eventInput({ startDate: "2026-11-01T15:00:00.000Z" }));

    expect(res.status).toBe(400);
  });

  test("時間帯が HH:mm の形式でなければ 400", async () => {
    const res = await createBrowser().post(
      "/events",
      eventInput({ allowedRanges: [{ startTime: "2026-11-01T23:00:00.000Z", endTime: "2026-11-04T14:00:00.000Z" }] }),
    );

    expect(res.status).toBe(400);
  });

  test("時間帯が 15 分単位でなければ 400", async () => {
    const res = await createBrowser().post(
      "/events",
      eventInput({ allowedRanges: [{ startTime: "08:10", endTime: "23:00" }] }),
    );

    expect(res.status).toBe(400);
  });

  test("時間帯の開始が終了より後なら 400", async () => {
    const res = await createBrowser().post(
      "/events",
      eventInput({ allowedRanges: [{ startTime: "23:00", endTime: "08:00" }] }),
    );

    expect(res.status).toBe(400);
  });

  test("時間帯の終了は 24:00 にできる", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { allowedRanges: [{ startTime: "00:00", endTime: "24:00" }] });

    expect((await getEvent(host, id)).allowedRanges).toMatchObject([{ startTime: "00:00", endTime: "24:00" }]);
  });

  test("24:00 より後の時刻は 400", async () => {
    const res = await createBrowser().post(
      "/events",
      eventInput({ allowedRanges: [{ startTime: "08:00", endTime: "24:15" }] }),
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /events/mine", () => {
  test("ホストまたはゲストとして関わるイベントだけを返す", async () => {
    const me = createBrowser();
    const other = createBrowser();
    const hosted = await createEvent(me, { name: "主催" });
    const joined = await createEvent(other, { name: "参加" });
    await createEvent(other, { name: "無関係" });
    await submit(me, joined.id, joined.optionId);

    const res = await me.get("/events/mine");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string }[];
    expect(body.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      {
        id: hosted.id,
        name: "主催",
        description: "説明",
        startDate: "2026-11-02",
        endDate: "2026-11-04",
        timezone: "Asia/Tokyo",
        isHost: true,
        hasAnswered: false,
        guestCount: 0,
      },
      {
        id: joined.id,
        name: "参加",
        description: "説明",
        startDate: "2026-11-02",
        endDate: "2026-11-04",
        timezone: "Asia/Tokyo",
        isHost: false,
        hasAnswered: true,
        guestCount: 1,
      },
    ]);
  });

  test("関わるイベントが無ければ空配列", async () => {
    const res = await createBrowser().get("/events/mine");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("GET /events/:eventId", () => {
  test("存在しなければ 404", async () => {
    const res = await createBrowser().get(`/events/${missingEventId}`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "イベントが見つかりません。" });
  });

  test("id が 21 文字でなければ 400", async () => {
    const res = await createBrowser().get("/events/short");

    expect(res.status).toBe(400);
  });

  test("ゲストから見ると isHost は false で、自分の回答が meAsGuest に入る", async () => {
    const host = createBrowser();
    const guest = createBrowser();
    const { id, optionId } = await createEvent(host);
    await submit(guest, id, optionId, { comment: "  よろしく  " });

    const event = await getEvent(guest, id);

    const expectedGuest = {
      id: expect.any(String),
      name: "ゲスト",
      comment: "よろしく",
      eventId: id,
      slots: [
        {
          id: expect.any(String),
          startAt: slotOnNov2.startAt,
          endAt: slotOnNov2.endAt,
          eventId: id,
          guestId: expect.any(String),
          optionId,
        },
      ],
    };
    expect(event.isHost).toBe(false);
    // 自分の回答にだけ version が付く
    expect(event.meAsGuest).toEqual({ ...expectedGuest, version: expect.any(String) });
    expect(event.guests).toEqual([expectedGuest]);
    expect(event.meAsGuest.slots[0].guestId).toBe(event.meAsGuest.id);
  });

  test("回答していない人から見ると meAsGuest は null", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    await submit(createBrowser(), id, optionId);

    const event = await getEvent(createBrowser(), id);

    expect(event.isHost).toBe(false);
    expect(event.meAsGuest).toBeNull();
    expect(event.guests).toHaveLength(1);
  });

  test("ホストとゲストの browserId をレスポンスに含めない", async () => {
    const host = createBrowser();
    const guest = createBrowser();
    const { id, optionId } = await createEvent(host);
    await submit(guest, id, optionId);

    const res = await guest.get(`/events/${id}`);
    const text = await res.text();

    expect(text).not.toContain("browserId");
    expect(text).not.toContain(host.browserId);
    expect(text).not.toContain(guest.browserId);
  });
});

describe("PATCH /events/:eventId", () => {
  test("ホスト以外は 403", async () => {
    const { id } = await createEvent(createBrowser());

    const res = await createBrowser().patch(`/events/${id}`, { name: "乗っ取り" });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "アクセス権限がありません。" });
  });

  test("存在しないイベントは 403", async () => {
    const res = await createBrowser().patch(`/events/${missingEventId}`, { name: "x" });

    expect(res.status).toBe(403);
  });

  test("時間帯が HH:mm の形式でなければ 400", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host);

    const res = await host.patch(`/events/${id}`, {
      allowedRanges: [{ startTime: "2026-11-10T00:00:00.000Z", endTime: "2026-11-10T09:00:00.000Z" }],
    });

    expect(res.status).toBe(400);
  });

  test("ゲストがいなければ、名前・説明・日程・時間帯を更新できる", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host);

    const res = await host.patch(`/events/${id}`, {
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

  test("ゲストがいると、名前と説明だけ更新し、日程と時間帯は変えない", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    await submit(createBrowser(), id, optionId);

    const res = await host.patch(`/events/${id}`, {
      name: "新しい名前",
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      allowedRanges: [{ startTime: "09:00", endTime: "18:00" }],
    });

    expect(res.status).toBe(200);
    const event = await getEvent(host, id);
    expect(event).toMatchObject({
      name: "新しい名前",
      startDate: "2026-11-02",
      endDate: "2026-11-04",
      allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
    });
  });

  test("省略したフィールドは変えない", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host);

    const res = await host.patch(`/events/${id}`, { name: "新しい名前" });

    expect(res.status).toBe(200);
    expect(await getEvent(host, id)).toMatchObject({
      name: "新しい名前",
      description: "説明",
      startDate: "2026-11-02",
      endDate: "2026-11-04",
      allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
      options: [{ label: "参加" }],
    });
  });

  test("何も指定しなくても 200 で、何も変えない", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host);

    const res = await host.patch(`/events/${id}`, {});

    expect(res.status).toBe(200);
    expect(await getEvent(host, id)).toMatchObject({ name: "テストイベント", description: "説明" });
  });

  test("空文字の説明と空の時間帯を指定すると、消える", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host);

    await host.patch(`/events/${id}`, { description: "", allowedRanges: [] });

    expect(await getEvent(host, id)).toMatchObject({ description: "", allowedRanges: [] });
  });

  test("参加形態を追加・変更・削除できる", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, {
      options: [
        { id: crypto.randomUUID(), label: "参加", color: "#0F82B1" },
        { id: crypto.randomUUID(), label: "消す", color: "#000000" },
      ],
    });
    const [kept] = (await getEvent(host, id)).options.filter((o: { label: string }) => o.label === "参加");
    const added = { id: crypto.randomUUID(), label: "オンライン", color: "#FF0000" };

    const res = await host.patch(`/events/${id}`, {
      options: [{ id: kept.id, label: "対面", color: "#00FF00" }, added],
    });

    expect(res.status).toBe(200);
    const options = (await getEvent(host, id)).options;
    expect(options.sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label))).toEqual([
      { ...added, eventId: id },
      { id: kept.id, label: "対面", color: "#00FF00", eventId: id },
    ]);
  });

  test("Slot が紐づく参加形態は削除できない", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    await submit(createBrowser(), id, optionId);

    const res = await host.patch(`/events/${id}`, {
      options: [{ id: crypto.randomUUID(), label: "別", color: "#000000" }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "以下の参加形態は日程が登録されているため削除できません: 参加" });
    expect((await getEvent(host, id)).options).toHaveLength(1);
  });

  test("参加形態を 0 件にはできない", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host);

    const res = await host.patch(`/events/${id}`, { options: [] });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /events/:eventId", () => {
  test("ホスト以外は 403", async () => {
    const { id } = await createEvent(createBrowser());

    const res = await createBrowser().delete(`/events/${id}`);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "削除権限がありません。" });
  });

  test("ホストは、ゲストの回答ごと削除できる。204 で本文は無い", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    await submit(createBrowser(), id, optionId);

    const res = await host.delete(`/events/${id}`);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect((await host.get(`/events/${id}`)).status).toBe(404);
  });
});

describe("POST /events/:eventId/submissions", () => {
  test("回答すると 201", async () => {
    const { id, optionId } = await createEvent(createBrowser());
    const guest = createBrowser();

    const res = await guest.post(`/events/${id}/submissions`, submissionInput(optionId));

    expect(res.status).toBe(201);
    const { meAsGuest } = await getEvent(guest, id);
    expect(meAsGuest).toMatchObject({ name: "ゲスト", comment: "コメント" });
    expect(await res.json()).toEqual({ guest: meAsGuest });
  });

  test("空白だけのコメントは null になる", async () => {
    const { id, optionId } = await createEvent(createBrowser());
    const guest = createBrowser();

    await submit(guest, id, optionId, { comment: "  " });

    expect((await getEvent(guest, id)).meAsGuest.comment).toBeNull();
  });

  test("同じブラウザから 2 回目は 409", async () => {
    const { id, optionId } = await createEvent(createBrowser());
    const guest = createBrowser();
    await submit(guest, id, optionId);

    const res = await guest.post(`/events/${id}/submissions`, submissionInput(optionId));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: "提出済みです。" });
  });

  test("同じブラウザから同時に 2 回送っても、500 にならず、回答は 1 つ", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    const guest = createBrowser();

    const statuses = await Promise.all([
      guest.post(`/events/${id}/submissions`, submissionInput(optionId)),
      guest.post(`/events/${id}/submissions`, submissionInput(optionId)),
    ]).then((responses) => responses.map((r) => r.status).sort());

    expect(statuses).toEqual([201, 409]);
    expect((await getEvent(host, id)).guests).toHaveLength(1);
  });

  test("ホストが同時に 2 回送っても、予定は二重にならない", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);

    const responses = await Promise.all([
      host.post(`/events/${id}/submissions`, submissionInput(optionId)),
      host.post(`/events/${id}/submissions`, submissionInput(optionId)),
    ]);

    expect(responses.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    const event = await getEvent(host, id);
    expect(event.guests).toHaveLength(1);
    expect(event.guests[0].slots).toHaveLength(1);
  });

  test("ホストも回答できる", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);

    await submit(host, id, optionId);

    const event = await getEvent(host, id);
    expect(event.isHost).toBe(true);
    expect(event.meAsGuest).not.toBeNull();
    // ホストとゲストを別々の人として数えない
    expect(event.hosts).toEqual([{ id: event.meAsGuest.id, eventId: id }]);
    const { version: _, ...meAsGuest } = event.meAsGuest;
    expect(event.guests).toEqual([meAsGuest]);
  });

  test("回答したホストの /events/mine は、ホストとして 1 件だけ返す", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    await submit(host, id, optionId);

    const res = await host.get("/events/mine");

    expect(await res.json()).toEqual([expect.objectContaining({ id, isHost: true })]);
  });

  test("名前が空なら 400", async () => {
    const { id, optionId } = await createEvent(createBrowser());

    const res = await createBrowser().post(`/events/${id}/submissions`, submissionInput(optionId, { name: "" }));

    expect(res.status).toBe(400);
  });

  test("存在しないイベントに回答すると 404", async () => {
    const res = await createBrowser().post(
      `/events/${missingEventId}/submissions`,
      submissionInput(crypto.randomUUID(), { slots: [] }),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "イベントが見つかりません。" });
  });
});

// 検証の中身は slots.test.ts で確かめる。ここでは、提出と更新で検証が効いていることだけを確かめる
describe("日程の提出・更新での Slot の検証", () => {
  test("イベントの期間外なら 400", async () => {
    const { id, optionId } = await createEvent(createBrowser());

    const res = await createBrowser().post(
      `/events/${id}/submissions`,
      submissionInput(optionId, {
        // 11/01 10:00〜12:00
        slots: [{ startAt: "2026-11-01T01:00:00.000Z", endAt: "2026-11-01T03:00:00.000Z", optionId }],
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: expect.stringContaining("日程の範囲") });
  });

  test("別のイベントの参加形態なら 400", async () => {
    const { id } = await createEvent(createBrowser());
    const other = await createEvent(createBrowser());

    const res = await createBrowser().post(`/events/${id}/submissions`, submissionInput(other.optionId));

    expect(res.status).toBe(400);
  });

  test("回答の更新でも検証し、弾いたときは元の回答を変えない", async () => {
    const { id, optionId } = await createEvent(createBrowser());
    const guest = createBrowser();
    await submit(guest, id, optionId);

    const res = await guest.put(
      `/events/${id}/submissions/mine`,
      submissionInput(optionId, {
        name: "新しい名前",
        // 11/01 10:00〜12:00
        slots: [{ startAt: "2026-11-01T01:00:00.000Z", endAt: "2026-11-01T03:00:00.000Z", optionId }],
      }),
    );

    expect(res.status).toBe(400);
    const { meAsGuest } = await getEvent(guest, id);
    expect(meAsGuest).toMatchObject({
      name: "ゲスト",
      slots: [{ startAt: slotOnNov2.startAt, endAt: slotOnNov2.endAt }],
    });
  });
});

describe("PUT /events/:eventId/submissions/mine", () => {
  test("回答していなければ 404", async () => {
    const { id, optionId } = await createEvent(createBrowser());

    const res = await createBrowser().put(`/events/${id}/submissions/mine`, submissionInput(optionId));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "既存の日程が見つかりません。" });
  });

  test("名前・コメント・Slot を置き換える", async () => {
    const { id, optionId } = await createEvent(createBrowser());
    const guest = createBrowser();
    await submit(guest, id, optionId);
    const newSlot = {
      startAt: "2026-11-03T05:00:00.000Z",
      endAt: "2026-11-03T06:00:00.000Z",
      optionId,
    };

    const res = await guest.put(
      `/events/${id}/submissions/mine`,
      submissionInput(optionId, { name: "新しい名前", comment: "", slots: [newSlot] }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      guest: {
        id: expect.any(String),
        name: "新しい名前",
        comment: null,
        eventId: id,
        slots: [
          {
            id: expect.any(String),
            startAt: newSlot.startAt,
            endAt: newSlot.endAt,
            eventId: id,
            guestId: expect.any(String),
            optionId,
          },
        ],
        version: expect.any(String),
      },
    });
    const { meAsGuest } = await getEvent(guest, id);
    expect(meAsGuest.slots).toEqual([expect.objectContaining({ startAt: newSlot.startAt, endAt: newSlot.endAt })]);
  });

  // D1 は 1 つの文のバインド変数が 100 個まで (Slot 1 行で 6 個)。ローカルの D1 はこの上限を強制しないので、
  // ここで確かめられるのは、分割した INSERT で全件が入ることまで
  test("1 つの文に収まらない数の Slot も保存できる", async () => {
    const { id, optionId } = await createEvent(createBrowser());
    const guest = createBrowser();
    await submit(guest, id, optionId);
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

    const res = await guest.put(`/events/${id}/submissions/mine`, submissionInput(optionId, { slots }));

    expect(res.status).toBe(200);
    expect((await getEvent(guest, id)).meAsGuest.slots).toHaveLength(45);
  });

  test("他のゲストの回答は変えない", async () => {
    const { id, optionId } = await createEvent(createBrowser());
    const guest = createBrowser();
    const other = createBrowser();
    await submit(guest, id, optionId);
    await submit(other, id, optionId, { name: "他の人" });

    await guest.put(`/events/${id}/submissions/mine`, submissionInput(optionId, { slots: [] }));

    const { meAsGuest } = await getEvent(other, id);
    expect(meAsGuest).toMatchObject({ name: "他の人", slots: [expect.anything()] });
  });
});

describe("updateMyAvailability の楽観ロック (basedOnVersion)", () => {
  const db = () => createDb(env.DB);

  async function setup() {
    const { id, optionId } = await createEvent(createBrowser());
    const guest = createBrowser();
    await submit(guest, id, optionId);
    const actor = { browserId: guest.browserId, userId: null };
    const { meAsGuest } = await getEvent(guest, id);
    return { id, optionId, actor, version: meAsGuest.version as string };
  }

  function input(optionId: string, name: string) {
    return {
      name,
      comment: null,
      slots: [{ startAt: new Date(slotOnNov2.startAt), endAt: new Date(slotOnNov2.endAt), optionId }],
    };
  }

  test("version が一致すれば更新し、新しい version を返す", async () => {
    const { id, optionId, actor, version } = await setup();

    const updated = await updateMyAvailability(db(), actor, id, input(optionId, "新しい名前"), version);

    expect(updated?.name).toBe("新しい名前");
    expect(updated?.version).not.toBe(version);
  });

  test("version が古ければ version_conflict を投げ、更新しない", async () => {
    const { id, optionId, actor, version } = await setup();
    await updateMyAvailability(db(), actor, id, input(optionId, "別の端末で変えた"));

    const promise = updateMyAvailability(db(), actor, id, input(optionId, "古い内容"), version);

    await expect(promise).rejects.toMatchObject({ reason: "version_conflict" });
    const guest = await db().query.participant.findFirst({ where: eq(schema.participant.eventId, id) });
    expect(guest?.name).not.toBe("古い内容");
  });

  test("basedOnVersion を省略すれば確かめない (Web UI)", async () => {
    const { id, optionId, actor } = await setup();
    await updateMyAvailability(db(), actor, id, input(optionId, "1 回目"));

    const updated = await updateMyAvailability(db(), actor, id, input(optionId, "2 回目"));

    expect(updated?.name).toBe("2 回目");
  });
});
