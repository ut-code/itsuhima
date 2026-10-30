import { and, eq } from "drizzle-orm";
import { type Db, runBatch } from "../db/index.js";
import * as schema from "../db/schema.js";

/** redirect_uri のホスト名。クライアント名は誰でも名乗れるので、見分けるのに使う */
function hostOf(uri: string) {
  try {
    return new URL(uri).hostname;
  } catch {
    return null;
  }
}

/**
 * Better Auth の配列の列。Better Auth の adapter が JSON の文字列にしてから入れるので、Drizzle で読むと文字列が返る
 */
function stringArray(value: unknown): string[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

/**
 * MCP で接続中のアプリ (OAuth で許可したクライアント) の一覧。新しく許可したものから。
 */
export async function listConnections(db: Db, userId: string) {
  const consents = await db
    .select({
      clientId: schema.oauthConsent.clientId,
      scopes: schema.oauthConsent.scopes,
      createdAt: schema.oauthConsent.createdAt,
      updatedAt: schema.oauthConsent.updatedAt,
      name: schema.oauthClient.name,
      redirectUris: schema.oauthClient.redirectUris,
    })
    .from(schema.oauthConsent)
    .innerJoin(schema.oauthClient, eq(schema.oauthConsent.clientId, schema.oauthClient.clientId))
    .where(eq(schema.oauthConsent.userId, userId));

  return consents
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((c) => ({
      clientId: c.clientId,
      name: c.name,
      redirectHosts: [
        ...new Set(
          stringArray(c.redirectUris)
            .map(hostOf)
            .filter((host): host is string => host !== null),
        ),
      ],
      scopes: stringArray(c.scopes),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
}

/** 許可が残っているか。/mcp で、アクセストークン (JWT) を検証した後に確かめる (失効をすぐ効かせるため) */
export async function hasConnection(db: Db, userId: string, clientId: string) {
  const consent = await db.query.oauthConsent.findFirst({
    where: and(eq(schema.oauthConsent.userId, userId), eq(schema.oauthConsent.clientId, clientId)),
    columns: { id: true },
  });
  return consent !== undefined;
}

/**
 * 接続を切る。許可とトークンを消す。リフレッシュできなくなり、/mcp も許可が無いので受け付けなくなる。
 * Better Auth の delete-consent はトークンを消さないので、自分で消す。
 */
export async function revokeConnection(db: Db, userId: string, clientId: string) {
  await runBatch(db, [
    db
      .delete(schema.oauthAccessToken)
      .where(and(eq(schema.oauthAccessToken.userId, userId), eq(schema.oauthAccessToken.clientId, clientId))),
    db
      .delete(schema.oauthRefreshToken)
      .where(and(eq(schema.oauthRefreshToken.userId, userId), eq(schema.oauthRefreshToken.clientId, clientId))),
    db
      .delete(schema.oauthConsent)
      .where(and(eq(schema.oauthConsent.userId, userId), eq(schema.oauthConsent.clientId, clientId))),
  ]);
}
