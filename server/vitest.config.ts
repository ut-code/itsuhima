import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => ({
  plugins: [
    // テストは Workers のランタイム (workerd) の中で動き、D1 はローカル (miniflare) のものを使う
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        // マイグレーションのテスト用。DB は全テストで共有し、beforeEach で最新のスキーマにするので、別に持つ
        d1Databases: ["MIGRATION_TEST_DB"],
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
          COOKIE_SECRET: "test-secret",
          NODE_ENV: "test",
          PUBLIC_ORIGIN: "http://localhost:3000",
          BETTER_AUTH_SECRET: "test-better-auth-secret-0123456789abcdef",
          GOOGLE_CLIENT_ID: "test-google-client-id",
          GOOGLE_CLIENT_SECRET: "test-google-client-secret",
        },
      },
    }),
  ],
  test: {
    setupFiles: ["./test/setup.ts"],
    // 全テストで 1 つの DB を共有するので、ファイルを並列に流さない
    fileParallelism: false,
    restoreMocks: true,
  },
}));
