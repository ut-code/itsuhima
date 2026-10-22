import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

/**
 * マイグレーションのテスト用に、`name` の直前までのマイグレーションを当てた DB を用意する。
 * 返り値の `db` に旧スキーマのデータを入れてから `migrate()` で残りを当て、データの変換を確かめる。
 * @param name マイグレーションのファイル名 (例: "0001_add_timezone.sql")
 */
export async function migrateUntil(name: string) {
  const db = env.MIGRATION_TEST_DB;
  const index = env.TEST_MIGRATIONS.findIndex((m) => m.name === name);
  if (index === -1) throw new Error(`マイグレーションが見つかりません: ${name}`);

  await dropAllTables(db);
  await applyD1Migrations(db, env.TEST_MIGRATIONS.slice(0, index));

  return {
    db,
    /** 残りのマイグレーションをすべて当てる */
    migrate: () => applyD1Migrations(db, env.TEST_MIGRATIONS),
  };
}

export async function tableNames(db: D1Database) {
  const { results } = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

/** 参照されているテーブルを先に消すと、参照する側の DROP が失敗するので、参照する側から消す */
async function dropAllTables(db: D1Database) {
  const remaining = new Map<string, string[]>();
  for (const name of await tableNames(db)) {
    const { results } = await db.prepare(`PRAGMA foreign_key_list("${name}")`).all<{ table: string }>();
    remaining.set(
      name,
      results.map((r) => r.table),
    );
  }

  while (remaining.size > 0) {
    const referenced = new Set([...remaining.entries()].flatMap(([name, refs]) => refs.filter((r) => r !== name)));
    const droppable = [...remaining.keys()].filter((name) => !referenced.has(name));
    if (droppable.length === 0) throw new Error(`循環参照があり、テーブルを消せません: ${[...remaining.keys()]}`);
    await db.batch(droppable.map((name) => db.prepare(`DROP TABLE "${name}"`)));
    for (const name of droppable) remaining.delete(name);
  }
}
