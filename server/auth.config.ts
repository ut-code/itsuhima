/**
 * Better Auth のスキーマ生成専用の設定 (実行時には使わない)。
 * src/auth.ts の createAuth とプラグインの構成をそろえ、値はダミーにする。
 *
 *   npx auth@1.7.14 generate --config auth.config.ts --output <一時ファイル> -y
 *
 * 出力のテーブルを src/db/schema.ts に移し、npm run db:generate でマイグレーションにする。
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { authPlugins } from "./src/authPlugins.js";

export const auth = betterAuth({
  // camelCase: 列名をこのリポジトリの規則 (camelCase) にする
  database: drizzleAdapter(drizzle({} as never), { provider: "sqlite", camelCase: true }),
  socialProviders: { google: { clientId: "x", clientSecret: "x" } },
  plugins: authPlugins("https://example.com"),
});
