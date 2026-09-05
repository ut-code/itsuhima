import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * MCP の API トークンに付与できる権限スコープ。
 * - read:   イベントの閲覧・集計
 * - submit: 自分の日程の提出・更新
 * - create: イベントの作成・編集
 */
export const SCOPES = ["read", "submit", "create"] as const;
export type Scope = (typeof SCOPES)[number];

/**
 * ユースケースの実行主体。Web の Cookie 経由でも MCP のトークン経由でも同じ形に正規化する。
 */
export type Actor = {
  browserId: string;
  /** 監査ログで人間の操作と MCP 経由を区別するために持つ */
  via: "web" | "mcp";
  tokenId?: string;
  scopes: readonly Scope[];
};

/** Web からのリクエストは常に全スコープを持つ */
export function webActor(browserId: string): Actor {
  return { browserId, via: "web", scopes: SCOPES };
}

/**
 * ユースケース層が投げる業務エラー。ルート層で HTTP レスポンスに変換する。
 * message は LLM がそのまま読んで復旧できるよう、自然文で復旧手順まで書くこと。
 */
export class UseCaseError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message);
    this.name = "UseCaseError";
  }
}

export function assertScope(actor: Actor, scope: Scope): void {
  if (!actor.scopes.includes(scope)) {
    throw new UseCaseError(
      403,
      `この操作には "${scope}" スコープが必要ですが、使用中のトークンには付与されていません。`,
    );
  }
}
