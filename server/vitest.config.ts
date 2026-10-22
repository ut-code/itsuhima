import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/env.js";

export default defineConfig({
  test: {
    globalSetup: ["./test/globalSetup.ts"],
    setupFiles: ["./test/setup.ts"],
    // 全テストで 1 つの DB を共有するので、ファイルを並列に流さない
    fileParallelism: false,
    unstubEnvs: true,
    restoreMocks: true,
    env: {
      DATABASE_URL: testDatabaseUrl,
      COOKIE_SECRET: "test-secret",
      DOMAIN: "localhost",
    },
  },
});
