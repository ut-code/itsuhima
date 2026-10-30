import { env } from "cloudflare:workers";
import { serializeSigned } from "hono/utils/cookie";
import { describe, expect, test } from "vitest";
import { createEvent, requestWorker } from "./helpers.js";

async function addLegacyRow(browserId: string, eventId: string, isHost: boolean, participantId: string | null) {
  await env.DB.prepare(
    `INSERT INTO "legacyBrowserEvent" (browserId, eventId, isHost, participantId) VALUES (?, ?, ?, ?)`,
  )
    .bind(browserId, eventId, isHost ? 1 : 0, participantId)
    .run();
}

async function exchange(cookie?: string, bindings: Record<string, string> = {}) {
  return requestWorker("/api/legacy/exchange", { method: "POST", headers: cookie ? { Cookie: cookie } : {} }, bindings);
}

async function legacyRows() {
  const { results } = await env.DB.prepare(`SELECT browserId, eventId FROM "legacyBrowserEvent"`).all();
  return results;
}

describe("POST /api/legacy/exchange", () => {
  test("browserId の Cookie で、作ったイベントと回答したイベントを返し、その行を消す", async () => {
    const hosted = await createEvent();
    const joined = await createEvent();
    const others = await createEvent();
    await addLegacyRow("me", hosted.id, true, null);
    await addLegacyRow("me", joined.id, false, "p1");
    await addLegacyRow("other", others.id, true, "p2");
    const cookie = await serializeSigned("browserId", "me", env.COOKIE_SECRET);

    const res = await exchange(cookie);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string }[];
    expect(body.sort((a, b) => Number(b.id === hosted.id) - Number(a.id === hosted.id))).toEqual([
      { id: hosted.id, isHost: true, participantId: null },
      { id: joined.id, isHost: false, participantId: "p1" },
    ]);
    expect(await legacyRows()).toEqual([{ browserId: "other", eventId: others.id }]);
    // 一度交換したら、次からは空
    expect(await (await exchange(cookie)).json()).toEqual([]);
    // Cookie は消さない
    expect(res.headers.get("Set-Cookie") ?? "").not.toMatch(/browserId/);
  });

  test("Cookie が無ければ空の配列", async () => {
    const res = await exchange();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("署名が不正な Cookie なら空の配列で、行は消さない", async () => {
    const { id } = await createEvent();
    await addLegacyRow("me", id, true, null);
    const cookie = await serializeSigned("browserId", "me", "wrong-secret");

    const res = await exchange(cookie);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(await legacyRows()).toHaveLength(1);
  });

  test("前の鍵で署名された Cookie も検証できる", async () => {
    const { id } = await createEvent();
    await addLegacyRow("me", id, true, null);
    const cookie = await serializeSigned("browserId", "me", "old-secret");

    const res = await exchange(cookie, { COOKIE_SECRET: "new-secret", COOKIE_SECRET_PREVIOUS: "older, old-secret" });

    expect(await res.json()).toEqual([{ id, isHost: true, participantId: null }]);
  });

  test("イベントを消すと、別表の行も消える", async () => {
    const { id } = await createEvent();
    await addLegacyRow("me", id, true, null);

    await env.DB.prepare(`DELETE FROM "event" WHERE id = ?`).bind(id).run();

    expect(await legacyRows()).toEqual([]);
  });
});

describe("DELETE /api/legacy/browser", () => {
  test("browserId の行を消し、Domain 付きと host-only の browserId の Cookie を消す", async () => {
    const mine = await createEvent();
    const others = await createEvent();
    await addLegacyRow("me", mine.id, true, null);
    await addLegacyRow("other", others.id, true, null);
    const cookie = await serializeSigned("browserId", "me", env.COOKIE_SECRET);

    const res = await requestWorker("/api/legacy/browser", { method: "DELETE", headers: { Cookie: cookie } });

    expect(res.status).toBe(204);
    expect(await legacyRows()).toEqual([{ browserId: "other", eventId: others.id }]);
    const cleared = res.headers.getSetCookie().filter((c) => c.startsWith("browserId=;") && /Max-Age=0/.test(c));
    const hostname = new URL(env.PUBLIC_ORIGIN).hostname;
    expect(cleared.map((c) => /Domain=([^;]+)/.exec(c)?.[1] ?? null).sort()).toEqual([hostname, null].sort());
  });

  test("Cookie が無くても 204 で、行は消さない", async () => {
    const { id } = await createEvent();
    await addLegacyRow("me", id, true, null);

    const res = await requestWorker("/api/legacy/browser", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(await legacyRows()).toEqual([{ browserId: "me", eventId: id }]);
  });
});
