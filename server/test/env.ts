/** テスト用の DB。開発用の DB (itsuhima_dev) を消さないよう、別のデータベースにする */
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:password@localhost:5432/itsuhima_test";
