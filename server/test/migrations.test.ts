import { describe, expect, test } from "vitest";
import { migrateUntil, tableNames } from "./migrations.js";

describe("migrateUntil", () => {
  test("指定したマイグレーションの直前まで当て、migrate() でそのマイグレーションだけを当てる", async () => {
    const { db, migrate } = await migrateUntil("0000_init.sql");
    expect(await tableNames(db)).toEqual(["d1_migrations"]);

    await migrate();

    const names = await tableNames(db);
    expect(names).toEqual(expect.arrayContaining(["Project", "Guest", "Slot"]));
    // 後のマイグレーションで作るテーブルは無い
    expect(names).not.toContain("participant");
  });

  test("前のテストのデータを残さない", async () => {
    const first = await migrateUntil("0000_init.sql");
    await first.migrate();
    await first.db.prepare(`INSERT INTO "Project" (id, name, startDate, endDate) VALUES ('p', 'name', 's', 'e')`).run();

    const second = await migrateUntil("0000_init.sql");
    await second.migrate();

    expect(await second.db.prepare(`SELECT * FROM "Project"`).all()).toMatchObject({ results: [] });
  });
});

describe("0001_add_project_timezone_created_at", () => {
  test("既存のイベントは Asia/Tokyo になり、作成日時はマイグレーションを当てた時刻で埋まる", async () => {
    const { db, migrate } = await migrateUntil("0001_add_project_timezone_created_at.sql");
    await db.batch([
      db.prepare(
        `INSERT INTO "Project" VALUES ('p', 'name', NULL, '2026-11-01T15:00:00.000Z', '2026-11-04T14:59:59.999Z')`,
      ),
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
      db.prepare(
        `INSERT INTO "Project" (id, name, startDate, endDate) VALUES ('p', 'name', '2026-11-01T15:00:00.000Z', '2026-11-04T14:59:59.999Z')`,
      ),
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

describe("0003_project_dates", () => {
  test("日程を JST の YYYY-MM-DD にする", async () => {
    const { db, migrate } = await migrateUntil("0003_project_dates.sql");
    // 11/02〜11/04 (JST)。開始は UTC では前日、終了は UTC でも同じ日
    await db
      .prepare(
        `INSERT INTO "Project" (id, name, startDate, endDate) VALUES ('p', 'name', '2026-11-01T15:00:00.000Z', '2026-11-04T14:59:59.999Z')`,
      )
      .run();

    await migrate();

    expect(await db.prepare(`SELECT startDate, endDate FROM "Project"`).first()).toEqual({
      startDate: "2026-11-02",
      endDate: "2026-11-04",
    });
  });
});

describe("0004_rename_tables", () => {
  test("テーブル名を変えても行は残り、外部キーは新しい名前を参照する", async () => {
    const { db, migrate } = await migrateUntil("0004_rename_tables.sql");
    await db.batch([
      db.prepare(
        `INSERT INTO "Project" (id, name, startDate, endDate) VALUES ('p', 'name', '2026-11-02', '2026-11-04')`,
      ),
      db.prepare(`INSERT INTO "AllowedRange" VALUES ('a', '08:00', '23:00', 'p')`),
      db.prepare(`INSERT INTO "ParticipationOption" VALUES ('o', '参加', '#0F82B1', 'p')`),
      db.prepare(`INSERT INTO "Host" VALUES ('h', 'b', 'p')`),
      db.prepare(`INSERT INTO "Guest" VALUES ('g', 'ゲスト', NULL, 'b', 'p')`),
      db.prepare(
        `INSERT INTO "Slot" VALUES ('s', '2026-11-02T00:00:00.000Z', '2026-11-02T01:00:00.000Z', 'p', 'g', 'o')`,
      ),
    ]);

    await migrate();

    expect(await tableNames(db)).toEqual(
      expect.arrayContaining(["event", "allowedRange", "option", "slot", "Host", "Guest"]),
    );
    const counts = await db
      .prepare(
        `SELECT (SELECT count(*) FROM "event") AS event, (SELECT count(*) FROM "allowedRange") AS allowedRange,
          (SELECT count(*) FROM "option") AS option, (SELECT count(*) FROM "slot") AS slot`,
      )
      .first();
    expect(counts).toEqual({ event: 1, allowedRange: 1, option: 1, slot: 1 });
    const { results } = await db.prepare(`PRAGMA foreign_key_list("slot")`).all<{ table: string }>();
    expect(results.map((r) => r.table).sort()).toEqual(["Guest", "event", "option"]);

    // 外部キーの CASCADE も新しい名前で効く
    await db.batch([db.prepare(`DELETE FROM "slot"`), db.prepare(`DELETE FROM "event"`)]);
    expect(await db.prepare(`SELECT count(*) AS n FROM "allowedRange"`).first()).toEqual({ n: 0 });
  });
});

describe("0005_rename_columns", () => {
  test("列名とインデックス名を変えても行は残り、外部キーは新しい列名で効く", async () => {
    const { db, migrate } = await migrateUntil("0005_rename_columns.sql");
    await db.batch([
      db.prepare(`INSERT INTO "event" (id, name, startDate, endDate) VALUES ('p', 'name', '2026-11-02', '2026-11-04')`),
      db.prepare(`INSERT INTO "allowedRange" VALUES ('a', '08:00', '23:00', 'p')`),
      db.prepare(`INSERT INTO "option" VALUES ('o', '参加', '#0F82B1', 'p')`),
      db.prepare(`INSERT INTO "Guest" VALUES ('g', 'ゲスト', NULL, 'b', 'p')`),
      db.prepare(
        `INSERT INTO "slot" VALUES ('s', '2026-11-02T00:00:00.000Z', '2026-11-02T01:00:00.000Z', 'p', 'g', 'o')`,
      ),
    ]);

    await migrate();

    expect(await db.prepare(`SELECT eventId, startAt, endAt, guestId, optionId FROM "slot"`).first()).toEqual({
      eventId: "p",
      startAt: "2026-11-02T00:00:00.000Z",
      endAt: "2026-11-02T01:00:00.000Z",
      guestId: "g",
      optionId: "o",
    });
    expect(await db.prepare(`SELECT eventId FROM "allowedRange"`).first()).toEqual({ eventId: "p" });
    expect(await db.prepare(`SELECT eventId FROM "option"`).first()).toEqual({ eventId: "p" });
    const { results: indexes } = await db
      .prepare(
        `SELECT name FROM sqlite_master
          WHERE type = 'index' AND tbl_name IN ('allowedRange', 'option', 'slot') AND name NOT LIKE 'sqlite_%'`,
      )
      .all<{ name: string }>();
    expect(indexes.map((i) => i.name).sort()).toEqual([
      "allowedRange_eventId_idx",
      "option_eventId_label_key",
      "slot_eventId_startAt_idx",
      "slot_guestId_idx",
      "slot_optionId_idx",
    ]);

    // 同じイベントで同じラベルの参加形態は作れない
    await expect(db.prepare(`INSERT INTO "option" VALUES ('o2', '参加', '#000000', 'p')`).run()).rejects.toThrow(
      /UNIQUE/,
    );
    // 外部キーの CASCADE も新しい列名で効く
    await db.batch([db.prepare(`DELETE FROM "slot"`), db.prepare(`DELETE FROM "event"`)]);
    expect(await db.prepare(`SELECT count(*) AS n FROM "allowedRange"`).first()).toEqual({ n: 0 });
  });
});

describe("0006_merge_host_guest_into_participant", () => {
  test("Host と Guest を participant にまとめ、slot を participant に付け替える", async () => {
    const { db, migrate } = await migrateUntil("0006_merge_host_guest_into_participant.sql");
    await db.batch([
      db.prepare(`INSERT INTO "event" (id, name, startDate, endDate) VALUES ('p', 'name', '2026-11-02', '2026-11-04')`),
      db.prepare(`INSERT INTO "option" VALUES ('o', '参加', '#0F82B1', 'p')`),
      // ホストかつゲスト、ホストだけ、ゲストだけ
      db.prepare(`INSERT INTO "Host" VALUES ('h1', 'both', 'p')`),
      db.prepare(`INSERT INTO "Guest" VALUES ('g1', 'ホスト', 'よろしく', 'both', 'p')`),
      db.prepare(`INSERT INTO "Host" VALUES ('h2', 'hostOnly', 'p')`),
      db.prepare(`INSERT INTO "Guest" VALUES ('g2', 'ゲスト', NULL, 'guestOnly', 'p')`),
      db.prepare(
        `INSERT INTO "slot" VALUES ('s1', '2026-11-02T00:00:00.000Z', '2026-11-02T01:00:00.000Z', 'p', 'g1', 'o')`,
      ),
      db.prepare(
        `INSERT INTO "slot" VALUES ('s2', '2026-11-02T01:00:00.000Z', '2026-11-02T02:00:00.000Z', 'p', 'g2', 'o')`,
      ),
    ]);
    const before = Date.now();

    await migrate();

    const { results: participants } = await db
      .prepare(`SELECT id, eventId, role, name, comment, browserId, updatedAt FROM "participant" ORDER BY browserId`)
      .all<{ updatedAt: string }>();
    expect(participants).toEqual([
      {
        id: "g1",
        eventId: "p",
        role: "host",
        name: "ホスト",
        comment: "よろしく",
        browserId: "both",
        updatedAt: expect.any(String),
      },
      {
        id: "g2",
        eventId: "p",
        role: "guest",
        name: "ゲスト",
        comment: null,
        browserId: "guestOnly",
        updatedAt: expect.any(String),
      },
      {
        id: "h2",
        eventId: "p",
        role: "host",
        name: null,
        comment: null,
        browserId: "hostOnly",
        updatedAt: expect.any(String),
      },
    ]);
    for (const p of participants) {
      expect(new Date(p.updatedAt).getTime()).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
    }
    const { results: slots } = await db.prepare(`SELECT id, participantId FROM "slot" ORDER BY id`).all();
    expect(slots).toEqual([
      { id: "s1", participantId: "g1" },
      { id: "s2", participantId: "g2" },
    ]);
    const names = await tableNames(db);
    expect(names).not.toContain("Host");
    expect(names).not.toContain("Guest");
    const { results: fks } = await db.prepare(`PRAGMA foreign_key_list("slot")`).all<{ table: string }>();
    expect(fks.map((r) => r.table).sort()).toEqual(["event", "option", "participant"]);

    // 同じイベントに同じ browserId の参加者は作れず、role は host か guest だけ
    await expect(
      db.prepare(`INSERT INTO "participant" VALUES ('x', 'p', 'guest', NULL, NULL, 'both', 'now')`).run(),
    ).rejects.toThrow(/UNIQUE/);
    await expect(
      db.prepare(`INSERT INTO "participant" VALUES ('y', 'p', 'owner', NULL, NULL, 'other', 'now')`).run(),
    ).rejects.toThrow(/CHECK/);
    // 参加者を消すと、その Slot も消える
    await db.prepare(`DELETE FROM "participant" WHERE id = 'g2'`).run();
    expect(await db.prepare(`SELECT id FROM "slot"`).all()).toMatchObject({ results: [{ id: "s1" }] });
  });
});

describe("0008_add_participant_user_id", () => {
  test("participant に userId を足しても、既存の参加者と slot は残る", async () => {
    const { db, migrate } = await migrateUntil("0008_add_participant_user_id.sql");
    await db.batch([
      db.prepare(`INSERT INTO "event" (id, name, startDate, endDate) VALUES ('p', 'name', '2026-11-02', '2026-11-04')`),
      db.prepare(`INSERT INTO "option" VALUES ('o', '参加', '#0F82B1', 'p')`),
      db.prepare(`INSERT INTO "participant" VALUES ('g1', 'p', 'guest', 'ゲスト', NULL, 'b1', 'now')`),
      db.prepare(
        `INSERT INTO "slot" VALUES ('s1', '2026-11-02T00:00:00.000Z', '2026-11-02T01:00:00.000Z', 'p', 'g1', 'o')`,
      ),
    ]);

    await migrate();

    expect(await db.prepare(`SELECT id, browserId, userId FROM "participant"`).all()).toMatchObject({
      results: [{ id: "g1", browserId: "b1", userId: null }],
    });
    expect(await db.prepare(`SELECT id FROM "slot"`).all()).toMatchObject({ results: [{ id: "s1" }] });
  });

  test("同じイベントに同じユーザーの参加者は 1 人だけ。ユーザーを消すと userId が null になる", async () => {
    const { db, migrate } = await migrateUntil("0008_add_participant_user_id.sql");
    await migrate();
    await db.batch([
      db.prepare(`INSERT INTO "event" (id, name, startDate, endDate) VALUES ('p', 'name', '2026-11-02', '2026-11-04')`),
      db.prepare(`INSERT INTO "user" (id, name, email, updatedAt) VALUES ('u', 'A', 'a@example.com', 0)`),
      db.prepare(`INSERT INTO "participant" VALUES ('g1', 'p', 'guest', 'ゲスト', NULL, 'b1', 'now', 'u')`),
      // ログインしていない参加者 (userId が null) は何人いてもよい
      db.prepare(`INSERT INTO "participant" VALUES ('g2', 'p', 'guest', 'ゲスト', NULL, 'b2', 'now', NULL)`),
      db.prepare(`INSERT INTO "participant" VALUES ('g3', 'p', 'guest', 'ゲスト', NULL, 'b3', 'now', NULL)`),
    ]);

    await expect(
      db.prepare(`INSERT INTO "participant" VALUES ('g4', 'p', 'guest', NULL, NULL, 'b4', 'now', 'u')`).run(),
    ).rejects.toThrow(/UNIQUE/);

    await db.prepare(`DELETE FROM "user" WHERE id = 'u'`).run();
    expect(await db.prepare(`SELECT userId FROM "participant" WHERE id = 'g1'`).first()).toEqual({ userId: null });
  });
});

describe("0009_nullable_participant_browser_id", () => {
  test("ユーザーの参加者の browserId を null にし、参加者と slot は残る", async () => {
    const { db, migrate } = await migrateUntil("0009_nullable_participant_browser_id.sql");
    await db.batch([
      db.prepare(`INSERT INTO "event" (id, name, startDate, endDate) VALUES ('p', 'name', '2026-11-02', '2026-11-04')`),
      db.prepare(`INSERT INTO "option" VALUES ('o', '参加', '#0F82B1', 'p')`),
      db.prepare(`INSERT INTO "user" (id, name, email, updatedAt) VALUES ('u', 'A', 'a@example.com', 0)`),
      db.prepare(`INSERT INTO "participant" VALUES ('h', 'p', 'host', NULL, NULL, 'b1', 'now', 'u')`),
      db.prepare(`INSERT INTO "participant" VALUES ('g', 'p', 'guest', 'ゲスト', 'コメント', 'b2', 'now', NULL)`),
      db.prepare(
        `INSERT INTO "slot" VALUES ('s1', '2026-11-02T00:00:00.000Z', '2026-11-02T01:00:00.000Z', 'p', 'g', 'o')`,
      ),
    ]);

    await migrate();

    expect(await db.prepare(`SELECT * FROM "participant" ORDER BY id`).all()).toMatchObject({
      results: [
        { id: "g", eventId: "p", role: "guest", name: "ゲスト", comment: "コメント", browserId: "b2", userId: null },
        { id: "h", eventId: "p", role: "host", name: null, browserId: null, userId: "u" },
      ],
    });
    expect(await db.prepare(`SELECT id, participantId FROM "slot"`).all()).toMatchObject({
      results: [{ id: "s1", participantId: "g" }],
    });
    expect(await tableNames(db)).not.toContain("__old_participant");
  });

  test("持ち主はブラウザかユーザーの一方。ユーザーを消すと参加者と slot も消える", async () => {
    const { db, migrate } = await migrateUntil("0009_nullable_participant_browser_id.sql");
    await migrate();
    await db.batch([
      db.prepare(`INSERT INTO "event" (id, name, startDate, endDate) VALUES ('p', 'name', '2026-11-02', '2026-11-04')`),
      db.prepare(`INSERT INTO "option" VALUES ('o', '参加', '#0F82B1', 'p')`),
      db.prepare(`INSERT INTO "user" (id, name, email, updatedAt) VALUES ('u', 'A', 'a@example.com', 0)`),
      db.prepare(
        `INSERT INTO "participant" (id, eventId, role, name, userId, updatedAt) VALUES ('g1', 'p', 'guest', 'A', 'u', 'now')`,
      ),
      // ユーザーの参加者 (browserId が null) は何人いてもよい
      db.prepare(`INSERT INTO "user" (id, name, email, updatedAt) VALUES ('u2', 'B', 'b@example.com', 0)`),
      db.prepare(
        `INSERT INTO "participant" (id, eventId, role, name, userId, updatedAt) VALUES ('g2', 'p', 'guest', 'B', 'u2', 'now')`,
      ),
      db.prepare(
        `INSERT INTO "slot" VALUES ('s1', '2026-11-02T00:00:00.000Z', '2026-11-02T01:00:00.000Z', 'p', 'g1', 'o')`,
      ),
    ]);

    // 両方ある、両方ない、は入れられない
    await expect(
      db
        .prepare(
          `INSERT INTO "participant" (id, eventId, role, browserId, userId, updatedAt) VALUES ('x', 'p', 'guest', 'b', 'u', 'now')`,
        )
        .run(),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db.prepare(`INSERT INTO "participant" (id, eventId, role, updatedAt) VALUES ('y', 'p', 'guest', 'now')`).run(),
    ).rejects.toThrow(/CHECK/);

    await db.prepare(`DELETE FROM "user" WHERE id = 'u'`).run();
    expect(await db.prepare(`SELECT id FROM "participant"`).all()).toMatchObject({ results: [{ id: "g2" }] });
    expect(await db.prepare(`SELECT id FROM "slot"`).all()).toMatchObject({ results: [] });
  });
});
