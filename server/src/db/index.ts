import type { D1Database } from "@cloudflare/workers-types";
import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "./schema.js";

/**
 * Drizzle のインスタンスを作る。
 * (D1 のバインディングはリクエストの `env` からしか取れないためリクエストごとに作る)
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;

type BatchItem = Parameters<Db["batch"]>[0][number];

/**
 * 複数の文を 1 つのトランザクションで実行する。D1 は対話的なトランザクション (`db.transaction()`) に対応していないので、
 * 途中の結果を見て分岐する処理は、batch の前に済ませておく。
 */
export async function runBatch(db: Db, statements: BatchItem[]) {
  if (statements.length === 0) return;
  await db.batch(statements as [BatchItem, ...BatchItem[]]);
}

/** D1 の、1 つの文に渡せるバインド変数の上限 */
const MAX_BOUND_PARAMETERS = 100;

/**
 * 複数行の INSERT を、バインド変数の上限に収まる行数ずつの文に分ける。`runBatch` に渡す。
 * 0 行なら空配列を返す (Drizzle は 0 行の INSERT を作れない)。
 */
export function insertMany<T extends SQLiteTable>(db: Db, table: T, rows: T["$inferInsert"][]) {
  const rowsPerStatement = Math.floor(MAX_BOUND_PARAMETERS / Object.keys(getTableColumns(table)).length);
  const statements = [];
  for (let i = 0; i < rows.length; i += rowsPerStatement) {
    statements.push(db.insert(table).values(rows.slice(i, i + rowsPerStatement)));
  }
  return statements;
}
