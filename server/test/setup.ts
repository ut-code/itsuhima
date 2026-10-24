import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

// 外部キーで参照される側を後に消す。
// jwks (アクセストークンの署名鍵) は消さない。/mcp は isolate の中で JWKS をキャッシュし、知らない鍵に出会っても
// 30 秒に 1 回しか取り直さないので、テストごとに鍵が変わると検証に失敗する (本番では鍵は消えない)
const tables = [
  "slot",
  "participant",
  "allowedRange",
  "option",
  "event",
  "oauthClientAssertion",
  "oauthConsent",
  "oauthAccessToken",
  "oauthRefreshToken",
  "oauthClientResource",
  "oauthResource",
  "oauthClient",
  "session",
  "account",
  "verification",
  "user",
];

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB.batch(tables.map((table) => env.DB.prepare(`DELETE FROM "${table}"`)));
});
