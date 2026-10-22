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
    await first.db.prepare(`INSERT INTO "Project" VALUES ('p', 'name', NULL, 's', 'e')`).run();

    const second = await migrateUntil("0000_init.sql");
    await second.migrate();

    expect(await second.db.prepare(`SELECT * FROM "Project"`).all()).toMatchObject({ results: [] });
  });
});
