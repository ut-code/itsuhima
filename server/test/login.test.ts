import { describe, expect, test } from "vitest";
import { createBrowser, createEvent, submissionInput } from "./helpers.js";

const alice = { sub: "google-alice", email: "alice@example.com", name: "Alice" };

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
});
