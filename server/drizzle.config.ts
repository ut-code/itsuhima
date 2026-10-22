import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  // wrangler.toml の migrations_dir と揃える。適用は `wrangler d1 migrations apply` で行う
  out: "./migrations",
});
