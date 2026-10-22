import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

// 外部キーで参照される側を後に消す
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
  "jwks",
  "session",
  "account",
  "verification",
  "user",
];

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB.batch(tables.map((table) => env.DB.prepare(`DELETE FROM "${table}"`)));
});
