import { mcp } from "@better-auth/mcp";
import { jwt } from "better-auth/plugins";

/** MCP のツールのスコープ。read: 読み取り、submit: 回答、create: イベントの作成 */
export const MCP_SCOPES = ["read", "submit", "create"] as const;

/** MCP サーバーの URL。接続済みのコネクタはこの URL を覚えるので、変えない */
export function mcpResource(origin: string) {
  return `${origin}/mcp`;
}

/**
 * Better Auth のプラグイン。src/auth.ts と、スキーマ生成用の auth.config.ts で共有する。
 * MCP クライアント向けに、Better Auth を OAuth 2.1 の認可サーバーにする。
 * @param origin ブラウザから見えるオリジン (PUBLIC_ORIGIN)
 */
export function authPlugins(origin: string) {
  return [
    // アクセストークンを JWT にする (/mcp で JWKS を使って検証し、リクエストごとに DB を読まない)。
    // issuer はオリジンのルートにし、/.well-known/oauth-authorization-server をルートで配信する (RFC 8414 どおり)
    jwt({ jwt: { issuer: origin } }),
    mcp({
      resource: mcpResource(origin),
      // ログインと同意は SPA のページ
      loginPage: "/login",
      consentPage: "/oauth/consent",
      // offline_access: リフレッシュトークンを出すのに要る
      scopes: ["openid", "profile", "email", "offline_access", ...MCP_SCOPES],
      // claude.ai の「Register automatically」や Claude Code は動的クライアント登録 (DCR) を使う
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // ループバックの http://localhost:PORT/callback (Claude Code など) を native として受け付ける
      clientRegistrationDefaultApplicationType: "infer",
    }),
  ];
}
