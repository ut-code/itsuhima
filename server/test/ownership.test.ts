import { describe, expect, test } from "vitest";
import { type ApiClient, api, createEvent, eventInput, login, submissionInput, submit } from "./helpers.js";

const alice = { sub: "google-alice" };
const bob = { sub: "google-bob" };

type EventBody = {
  canEdit: boolean;
  hasOwner: boolean;
  participants: { id: string; canEdit: boolean; canDelete: boolean; hasOwner: boolean; isMine: boolean }[];
};

async function getEvent(client: ApiClient, id: string) {
  const res = await client.get(`/events/${id}`);
  expect(res.status).toBe(200);
  return (await res.json()) as EventBody;
}

async function listHistory(client: ApiClient, id: string) {
  const res = await client.get(`/events/${id}/history`);
  expect(res.status).toBe(200);
  return (await res.json()) as { id: string; target: string; before: object; canRestore: boolean }[];
}

describe("ログインして作ったイベント", () => {
  test("作成の応答で hasOwner が true になる", async () => {
    const owner = await login(alice);

    const res = await owner.post("/events", eventInput());

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ hasOwner: true });
  });

  test("持ち主だけが、設定を変え、削除し、戻せる", async () => {
    const owner = await login(alice);
    const other = await login(bob);
    const { id } = await createEvent({}, owner);

    expect(await getEvent(owner, id)).toMatchObject({ canEdit: true, hasOwner: true });
    expect(await getEvent(api, id)).toMatchObject({ canEdit: false, hasOwner: true });
    expect(await getEvent(other, id)).toMatchObject({ canEdit: false, hasOwner: true });

    for (const client of [api, other]) {
      expect((await client.patch(`/events/${id}`, { name: "変更" })).status).toBe(403);
      expect((await client.delete(`/events/${id}`)).status).toBe(403);
    }
    expect((await owner.patch(`/events/${id}`, { name: "変更" })).status).toBe(200);
    expect((await owner.delete(`/events/${id}`)).status).toBe(204);
    expect((await api.post(`/events/${id}/restore`)).status).toBe(403);
    expect((await owner.post(`/events/${id}/restore`)).status).toBe(204);
  });

  test("設定の履歴は、持ち主だけが戻せる", async () => {
    const owner = await login(alice);
    const { id } = await createEvent({}, owner);
    await owner.patch(`/events/${id}`, { name: "変更" });

    const [history] = await listHistory(api, id);

    expect(history.canRestore).toBe(false);
    expect((await api.post(`/events/${id}/history/${history.id}/restore`)).status).toBe(403);
    expect((await listHistory(owner, id))[0].canRestore).toBe(true);
    expect((await owner.post(`/events/${id}/history/${history.id}/restore`)).status).toBe(204);
  });

  test("ログインしていない人も回答でき、その回答は誰でも変えられる", async () => {
    const owner = await login(alice);
    const { id, optionId } = await createEvent({}, owner);

    const participantId = await submit(id, optionId);

    expect((await getEvent(owner, id)).participants[0]).toMatchObject({ canEdit: true, hasOwner: false });
    expect((await api.put(`/events/${id}/participants/${participantId}`, submissionInput(optionId))).status).toBe(200);
  });
});

describe("ログインして出した回答", () => {
  test("その人だけが変えられる。自分の回答だとわかる", async () => {
    const guest = await login(bob);
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId, {}, guest);

    expect((await getEvent(guest, id)).participants[0]).toMatchObject({
      id: participantId,
      canEdit: true,
      canDelete: true,
      hasOwner: true,
      isMine: true,
    });
    expect((await getEvent(api, id)).participants[0]).toMatchObject({
      canEdit: false,
      canDelete: false,
      hasOwner: true,
      isMine: false,
    });
    const update = submissionInput(optionId, { name: "変更" });
    expect((await api.put(`/events/${id}/participants/${participantId}`, update)).status).toBe(403);
    expect((await api.delete(`/events/${id}/participants/${participantId}`)).status).toBe(403);
    expect((await guest.put(`/events/${id}/participants/${participantId}`, update)).status).toBe(200);
    // 匿名のイベントの設定は、ログインした人も誰でも変えられる
    expect((await guest.patch(`/events/${id}`, { name: "変更" })).status).toBe(200);
  });

  test("ログインして作ったイベントの持ち主は、ほかの人の回答を消せるが、変えられない", async () => {
    const owner = await login(alice);
    const guest = await login(bob);
    const { id, optionId } = await createEvent({}, owner);
    const participantId = await submit(id, optionId, {}, guest);

    expect((await getEvent(owner, id)).participants[0]).toMatchObject({ canEdit: false, canDelete: true });
    expect((await owner.put(`/events/${id}/participants/${participantId}`, submissionInput(optionId))).status).toBe(
      403,
    );
    expect((await owner.delete(`/events/${id}/participants/${participantId}`)).status).toBe(204);
  });

  test("1 つのイベントに 1 つだけ回答できる", async () => {
    const guest = await login(bob);
    const { id, optionId } = await createEvent();
    await submit(id, optionId, {}, guest);

    const res = await guest.post(`/events/${id}/participants`, submissionInput(optionId));

    expect(res.status).toBe(409);
    // ログインしていなければ、いくつでも回答できる
    await submit(id, optionId);
    await submit(id, optionId);
  });

  test("消した回答は、消せる人が、同じ持ち主の回答として戻せる。履歴に持ち主は出さない", async () => {
    const owner = await login(alice);
    const guest = await login(bob);
    const { id, optionId } = await createEvent({}, owner);
    const participantId = await submit(id, optionId, {}, guest);
    await owner.delete(`/events/${id}/participants/${participantId}`);

    const [history] = await listHistory(api, id);

    expect(history.before).not.toHaveProperty("userId");
    expect(history.canRestore).toBe(false);
    expect((await api.post(`/events/${id}/history/${history.id}/restore`)).status).toBe(403);
    expect((await owner.post(`/events/${id}/history/${history.id}/restore`)).status).toBe(204);
    expect((await getEvent(guest, id)).participants[0]).toMatchObject({ id: participantId, isMine: true });
  });

  test("回答し直した後は、消した回答を戻せない", async () => {
    const guest = await login(bob);
    const { id, optionId } = await createEvent();
    const participantId = await submit(id, optionId, {}, guest);
    await guest.delete(`/events/${id}/participants/${participantId}`);
    await submit(id, optionId, {}, guest);

    const [history] = (await listHistory(guest, id)).filter((h) => h.target === "participant");

    expect((await guest.post(`/events/${id}/history/${history.id}/restore`)).status).toBe(409);
  });
});

describe("GET /me/events", () => {
  test("作ったイベントと回答したイベントを返す", async () => {
    const user = await login(alice);
    const hosted = await createEvent({ name: "作った" }, user);
    const answered = await createEvent({ name: "回答した" });
    const participantId = await submit(answered.id, answered.optionId, {}, user);
    // 関係のないイベントと、ほかの人の回答
    await createEvent();
    await submit(hosted.id, hosted.optionId);

    const res = await user.get("/me/events");

    expect(res.status).toBe(200);
    const events = (await res.json()) as unknown[];
    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        {
          id: answered.id,
          name: "回答した",
          startDate: "2026-11-02",
          endDate: "2026-11-04",
          timezone: "Asia/Tokyo",
          deleted: false,
          isHost: false,
          participantId,
          participantCount: 1,
        },
        {
          id: hosted.id,
          name: "作った",
          startDate: "2026-11-02",
          endDate: "2026-11-04",
          timezone: "Asia/Tokyo",
          deleted: false,
          isHost: true,
          participantId: null,
          participantCount: 1,
        },
      ]),
    );
  });

  test("ログインしていなければ 401", async () => {
    const res = await api.get("/me/events");

    expect(res.status).toBe(401);
  });

  test("ログインせずに作ったイベントは含まない", async () => {
    await api.post("/events", eventInput());
    const user = await login(alice);

    expect(await (await user.get("/me/events")).json()).toEqual([]);
  });
});
