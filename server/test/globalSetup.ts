import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "./env.js";

export default function setup() {
  // setup.ts で毎回全テーブルを空にするので、誤って開発用や本番の DB に向けないようにする
  const dbName = new URL(testDatabaseUrl).pathname.slice(1);
  if (!dbName.includes("test")) {
    throw new Error(`テスト用の DB 名には "test" を含めてください: ${dbName}`);
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}
