import { createScheduledController } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import worker from "../src/main.js";
import { api, createEvent, submit } from "./helpers.js";

function runScheduled() {
  return worker.scheduled(createScheduledController(), env);
}

/** 削除した日時を、days 日前にずらす */
async function backdateDeletion(eventId: string, days: number) {
  const deletedAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`UPDATE "event" SET "deletedAt" = ? WHERE "id" = ?`).bind(deletedAt, eventId).run();
}

describe("scheduled", () => {
  test("削除してから 7 日たったイベントを、回答ごと消す", async () => {
    const { id, optionId } = await createEvent();
    await submit(id, optionId);
    await api.delete(`/events/${id}`);
    await backdateDeletion(id, 7);

    await runScheduled();

    expect((await api.get(`/events/${id}`)).status).toBe(404);
    const { count } = (await env.DB.prepare(`SELECT count(*) AS count FROM "participant"`).first<{
      count: number;
    }>()) ?? { count: -1 };
    expect(count).toBe(0);
  });

  test("削除してから 7 日たっていないイベントと、削除していないイベントは残す", async () => {
    const deleted = await createEvent();
    const active = await createEvent();
    await api.delete(`/events/${deleted.id}`);
    await backdateDeletion(deleted.id, 6);

    await runScheduled();

    expect((await api.get(`/events/${deleted.id}`)).status).toBe(410);
    expect((await api.get(`/events/${active.id}`)).status).toBe(200);
  });
});
