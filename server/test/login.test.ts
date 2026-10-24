import { describe, expect, test } from "vitest";
import { createBrowser, createEvent, submissionInput } from "./helpers.js";

const alice = { sub: "google-alice", email: "alice@example.com", name: "Alice" };
const bob = { sub: "google-bob", email: "bob@example.com", name: "Bob" };

// biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを見るため
async function json(res: Response): Promise<any> {
  return res.json();
}

describe("ログインした本人の判定 (別の端末)", () => {
  test("ログインして作ったイベントは、別の端末で同じユーザーとしてログインすれば、ホストとして扱われる", async () => {
    const laptop = createBrowser();
    await laptop.login(alice);
    const { id } = await createEvent(laptop);

    const phone = createBrowser();
    await phone.login(alice);

    const mine = await json(await phone.get("/events/mine"));
    expect(mine).toEqual([expect.objectContaining({ id, isHost: true })]);
    expect(await json(await phone.get(`/events/${id}`))).toMatchObject({ isHost: true });
    expect((await phone.patch(`/events/${id}`, { name: "新しい名前" })).status).toBe(200);
  });

  test("ログインしていない別の端末は、ホストとして扱われない", async () => {
    const laptop = createBrowser();
    await laptop.login(alice);
    const { id } = await createEvent(laptop);

    const other = createBrowser();

    expect(await json(await other.get(`/events/${id}`))).toMatchObject({ isHost: false });
    expect((await other.patch(`/events/${id}`, { name: "x" })).status).toBe(403);
  });

  test("ログインして回答すると、別の端末でも自分の回答として見え、二重には回答できない", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    const laptop = createBrowser();
    await laptop.login(alice);
    expect((await laptop.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice" }))).status).toBe(
      201,
    );

    const phone = createBrowser();
    await phone.login(alice);

    expect(await json(await phone.get(`/events/${id}`))).toMatchObject({ meAsGuest: { name: "Alice" } });
    expect((await phone.post(`/events/${id}/submissions`, submissionInput(optionId))).status).toBe(409);
    expect(
      (await phone.put(`/events/${id}/submissions/mine`, submissionInput(optionId, { name: "Alice (スマホ)" }))).status,
    ).toBe(200);
    expect(await json(await laptop.get(`/events/${id}`))).toMatchObject({ meAsGuest: { name: "Alice (スマホ)" } });
  });
});

describe("ログインしたときの紐づけ", () => {
  test("ログインせずに回答したブラウザでログインすると、その回答が別の端末でも自分のものになる", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    const laptop = createBrowser();
    expect((await laptop.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice" }))).status).toBe(
      201,
    );

    await laptop.login(alice);
    const phone = createBrowser();
    await phone.login(alice);

    expect(await json(await phone.get(`/events/${id}`))).toMatchObject({ meAsGuest: { name: "Alice" } });
  });

  test("ログインせずにイベントを作ったブラウザでログインすると、別の端末でもホストになる", async () => {
    const laptop = createBrowser();
    const { id } = await createEvent(laptop);

    await laptop.login(alice);
    const phone = createBrowser();
    await phone.login(alice);

    expect(await json(await phone.get("/events/mine"))).toEqual([expect.objectContaining({ id, isHost: true })]);
  });

  test("同じイベントにすでにユーザーの回答があれば、紐づけず、どちらの回答も消さない", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    const laptop = createBrowser();
    await laptop.login(alice);
    await laptop.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice (PC)" }));
    const tablet = createBrowser();
    await tablet.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice (タブレット)" }));

    await tablet.login(alice);

    const event = await json(await host.get(`/events/${id}`));
    expect(event.guests.map((g: { name: string }) => g.name).sort()).toEqual(["Alice (PC)", "Alice (タブレット)"]);
    // ログインした端末では、ユーザーに紐づいた回答を自分のものとする
    expect(await json(await tablet.get(`/events/${id}`))).toMatchObject({ meAsGuest: { name: "Alice (PC)" } });
  });

  test("このブラウザで作って回答したイベントに、アカウントでも回答済みなら、紐づけないがホストとして扱われる", async () => {
    const tablet = createBrowser();
    const { id, optionId } = await createEvent(tablet);
    await tablet.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice (タブレット)" }));
    const laptop = createBrowser();
    await laptop.login(alice);
    await laptop.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice (PC)" }));

    await tablet.login(alice);

    expect(await json(await tablet.get(`/events/${id}`))).toMatchObject({
      isHost: true,
      meAsGuest: { name: "Alice (PC)" },
    });
    expect((await tablet.patch(`/events/${id}`, { name: "新しい名前" })).status).toBe(200);
  });

  test("このブラウザで作っただけのイベントに、アカウントで回答していれば、1 人にまとめる", async () => {
    const tablet = createBrowser();
    const { id, optionId } = await createEvent(tablet);
    const laptop = createBrowser();
    await laptop.login(alice);
    await laptop.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice", comment: "よろしく" }));

    await tablet.login(alice);

    const phone = createBrowser();
    await phone.login(alice);
    for (const device of [tablet, laptop, phone]) {
      expect(await json(await device.get(`/events/${id}`))).toMatchObject({
        isHost: true,
        meAsGuest: { name: "Alice", comment: "よろしく", slots: [expect.anything()] },
      });
    }
    const event = await json(await createBrowser().get(`/events/${id}`));
    expect(event.hosts).toHaveLength(1);
    expect(event.guests).toEqual([expect.objectContaining({ id: event.hosts[0].id, name: "Alice" })]);
    expect(await json(await tablet.get("/events/mine/link-conflicts"))).toEqual([]);
  });

  test("アカウントで作っただけのイベントに、このブラウザで回答していれば、1 人にまとめる", async () => {
    const laptop = createBrowser();
    await laptop.login(alice);
    const { id, optionId } = await createEvent(laptop);
    const tablet = createBrowser();
    await tablet.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice" }));

    await tablet.login(alice);

    for (const device of [tablet, laptop]) {
      expect(await json(await device.get(`/events/${id}`))).toMatchObject({
        isHost: true,
        meAsGuest: { name: "Alice", slots: [expect.anything()] },
      });
    }
    const event = await json(await createBrowser().get(`/events/${id}`));
    expect(event.guests).toEqual([expect.objectContaining({ id: event.hosts[0].id })]);
  });

  test("ぶつかって紐づけなかった参加者は、そのブラウザで知らせるために取れる", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host, { name: "合宿" });
    const laptop = createBrowser();
    await laptop.login(alice);
    await laptop.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice (PC)" }));
    const tablet = createBrowser();
    await tablet.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice (タブレット)" }));
    const { id: otherId } = await createEvent(tablet);

    expect(await json(await tablet.get("/events/mine/link-conflicts"))).toEqual([]);

    await tablet.login(alice);

    // 紐づけられた方 (tablet で作ったイベント) は入らない
    expect(await json(await tablet.get("/events/mine/link-conflicts"))).toEqual([
      { eventId: id, eventName: "合宿", isHost: false, name: "Alice (タブレット)" },
    ]);
    expect(await json(await laptop.get("/events/mine/link-conflicts"))).toEqual([]);
    expect(await json(await laptop.get("/events/mine"))).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: otherId, isHost: true })]),
    );
  });
});

describe("ログアウト・同じブラウザでの別のユーザー", () => {
  test("ログアウトすると、ログインして作ったイベントと回答は、このブラウザからは操作できない", async () => {
    const host = createBrowser();
    const other = await createEvent(host);
    const pc = createBrowser();
    await pc.login(alice);
    const { id } = await createEvent(pc);
    await pc.post(`/events/${other.id}/submissions`, submissionInput(other.optionId, { name: "Alice" }));

    await pc.logout();

    expect(await json(await pc.get("/events/mine"))).toEqual([]);
    expect(await json(await pc.get(`/events/${id}`))).toMatchObject({ isHost: false });
    expect((await pc.delete(`/events/${id}`)).status).toBe(403);
    expect(await json(await pc.get(`/events/${other.id}`))).toMatchObject({ meAsGuest: null });
    expect((await pc.put(`/events/${other.id}/submissions/mine`, submissionInput(other.optionId))).status).toBe(404);
    // ログインせずに回答し直せる
    expect(
      (await pc.post(`/events/${other.id}/submissions`, submissionInput(other.optionId, { name: "ゲスト" }))).status,
    ).toBe(201);
  });

  test("ログインせずに回答してからログインすると、ログアウトした後は、このブラウザからは操作できない", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    const pc = createBrowser();
    await pc.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice" }));
    await pc.login(alice);

    await pc.logout();

    expect(await json(await pc.get(`/events/${id}`))).toMatchObject({ meAsGuest: null });
    await pc.login(alice);
    expect(await json(await pc.get(`/events/${id}`))).toMatchObject({ meAsGuest: { name: "Alice" } });
  });

  test("紐づけなかった回答は、ログアウトすると、このブラウザで編集できる", async () => {
    const host = createBrowser();
    const { id, optionId } = await createEvent(host);
    const laptop = createBrowser();
    await laptop.login(alice);
    await laptop.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice (PC)" }));
    const tablet = createBrowser();
    await tablet.post(`/events/${id}/submissions`, submissionInput(optionId, { name: "Alice (タブレット)" }));
    await tablet.login(alice);

    await tablet.logout();

    expect(await json(await tablet.get(`/events/${id}`))).toMatchObject({ meAsGuest: { name: "Alice (タブレット)" } });
    expect(
      (await tablet.put(`/events/${id}/submissions/mine`, submissionInput(optionId, { name: "編集" }))).status,
    ).toBe(200);
  });

  test("同じブラウザで別のユーザーがログインしても、前のユーザーのイベントと回答は操作できない", async () => {
    const host = createBrowser();
    const other = await createEvent(host);
    const pc = createBrowser();
    await pc.login(alice);
    const { id } = await createEvent(pc);
    await pc.post(`/events/${other.id}/submissions`, submissionInput(other.optionId, { name: "Alice" }));

    // ログアウトせず (セッションが切れたなど) に、別のユーザーがログインする
    await pc.login(bob);

    expect(await json(await pc.get("/events/mine"))).toEqual([]);
    expect((await pc.delete(`/events/${id}`)).status).toBe(403);
    expect(await json(await pc.get(`/events/${other.id}`))).toMatchObject({ meAsGuest: null });
    expect(
      (await pc.post(`/events/${other.id}/submissions`, submissionInput(other.optionId, { name: "Bob" }))).status,
    ).toBe(201);
    const event = await json(await host.get(`/events/${other.id}`));
    expect(event.guests.map((g: { name: string }) => g.name).sort()).toEqual(["Alice", "Bob"]);
  });
});
