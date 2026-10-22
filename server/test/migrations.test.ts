import { describe, expect, test } from "vitest";
import { migrateUntil, tableNames } from "./migrations.js";

describe("migrateUntil", () => {
  test("指定したマイグレーションの直前まで当て、migrate() で残りを当てる", async () => {
    const { db, migrate } = await migrateUntil("0000_init.sql");
    expect(await tableNames(db)).toEqual(["d1_migrations"]);

    await migrate();

    expect(await tableNames(db)).toEqual(expect.arrayContaining(["Project", "Guest", "Slot"]));
  });

  test("前のテストのデータを残さない", async () => {
    const first = await migrateUntil("0000_init.sql");
    await first.migrate();
    await first.db
      .prepare(`INSERT INTO "Project" (id, name, startDate, endDate, createdAt) VALUES ('p', 'name', 's', 'e', 'c')`)
      .run();

    const second = await migrateUntil("0000_init.sql");
    await second.migrate();

    expect(await second.db.prepare(`SELECT * FROM "Project"`).all()).toMatchObject({ results: [] });
  });
});

describe("0001_add_project_timezone_created_at", () => {
  test("既存のイベントは Asia/Tokyo になり、作成日時はマイグレーションを当てた時刻で埋まる", async () => {
    const { db, migrate } = await migrateUntil("0001_add_project_timezone_created_at.sql");
    await db.batch([
      db.prepare(`INSERT INTO "Project" VALUES ('p', 'name', NULL, 's', 'e')`),
      db.prepare(
        `INSERT INTO "AllowedRange" VALUES ('a', '2026-11-01T23:00:00.000Z', '2026-11-04T14:00:00.000Z', 'p')`,
      ),
    ]);
    const before = Date.now();

    await migrate();

    const project = await db
      .prepare(`SELECT timezone, createdAt FROM "Project"`)
      .first<{ timezone: string; createdAt: string }>();
    expect(project?.timezone).toBe("Asia/Tokyo");
    expect(project?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(project?.createdAt ?? "").getTime()).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
    // 子のテーブルの行は残る
    expect(await db.prepare(`SELECT id FROM "AllowedRange"`).all()).toMatchObject({ results: [{ id: "a" }] });
  });
});

describe("0002_allowed_range_time_of_day", () => {
  test("時間帯の時刻を JST の HH:mm にする", async () => {
    const { db, migrate } = await migrateUntil("0002_allowed_range_time_of_day.sql");
    await db.batch([
      db.prepare(`INSERT INTO "Project" (id, name, startDate, endDate) VALUES ('p', 'name', 's', 'e')`),
      // 11/02 08:00〜11/04 23:00 (JST)。UTC では日付が変わる時刻も含める
      db.prepare(
        `INSERT INTO "AllowedRange" VALUES ('a', '2026-11-01T23:00:00.000Z', '2026-11-04T14:00:00.000Z', 'p')`,
      ),
    ]);

    await migrate();

    expect(await db.prepare(`SELECT startTime, endTime FROM "AllowedRange"`).first()).toEqual({
      startTime: "08:00",
      endTime: "23:00",
    });
  });
});
