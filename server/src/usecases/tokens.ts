import crypto from "node:crypto";
import { prisma } from "../db.js";
import { type Actor, SCOPES, type Scope, UseCaseError } from "./types.js";

const TOKEN_PREFIX = "ith_";
/** ペアリングコードの有効期間 */
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseScopes(raw: string): Scope[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Scope => (SCOPES as readonly string[]).includes(s));
}

/**
 * Bearer トークンを検証して Actor を組み立てる。
 * 失敗理由は攻撃者に情報を与えないよう一律のメッセージにする。
 */
export async function authenticateToken(rawToken: string): Promise<Actor> {
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt.getTime() < Date.now())) {
    throw new UseCaseError(401, "API トークンが無効です。失効しているか有効期限が切れています。");
  }

  // 監査用。頻繁な更新になるが Web の書き込み量に比べれば無視できる。
  await prisma.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    browserId: token.browserId,
    via: "mcp",
    tokenId: token.id,
    scopes: parseScopes(token.scopes),
  };
}

export async function issueToken(browserId: string, name: string, scopes: readonly Scope[], expiresAt?: Date) {
  const raw = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;

  const token = await prisma.apiToken.create({
    data: {
      tokenHash: hashToken(raw),
      prefix: raw.slice(0, TOKEN_PREFIX.length + 6),
      name,
      browserId,
      scopes: scopes.join(","),
      expiresAt,
    },
  });

  // 平文はここでしか返さない
  return { token: raw, id: token.id, prefix: token.prefix, scopes, expiresAt: token.expiresAt };
}

export async function listTokens(browserId: string) {
  const tokens = await prisma.apiToken.findMany({
    where: { browserId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      prefix: true,
      name: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  return tokens.map((t) => ({ ...t, scopes: parseScopes(t.scopes) }));
}

export async function revokeToken(browserId: string, tokenId: string) {
  const result = await prisma.apiToken.updateMany({
    where: { id: tokenId, browserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) {
    throw new UseCaseError(404, "トークンが見つかりません。");
  }
}

// ---------------------------------------------------------------------------
// ペアリング
// ---------------------------------------------------------------------------

/**
 * Web UI から呼ぶ。現在の browserId に紐づく 6 桁コードを発行する。
 * アカウントが無いため、これが「この MCP クライアントは私だ」と示す唯一の手段になる。
 */
export async function createPairingCode(browserId: string) {
  // 期限切れコードは都度掃除する（cron を持ち込まないため）
  await prisma.pairingCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

  await prisma.pairingCode.upsert({
    where: { code },
    update: { browserId, expiresAt, usedAt: null },
    create: { code, browserId, expiresAt },
  });

  return { code, expiresAt };
}

/**
 * MCP クライアントから呼ぶ。コードを引き換えて API トークンを得る。
 */
export async function redeemPairingCode(code: string, clientName: string, scopes: readonly Scope[]) {
  const pairing = await prisma.pairingCode.findUnique({ where: { code } });

  if (!pairing || pairing.usedAt || pairing.expiresAt.getTime() < Date.now()) {
    throw new UseCaseError(
      400,
      "連携コードが無効です。有効期限は 10 分です。イツヒマの設定画面で新しいコードを発行し直してください。",
    );
  }

  // 使い捨て。競合時は先勝ちになるよう updateMany の件数で判定する。
  const consumed = await prisma.pairingCode.updateMany({
    where: { code, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count === 0) {
    throw new UseCaseError(400, "この連携コードは既に使用されています。新しいコードを発行し直してください。");
  }

  return issueToken(pairing.browserId, clientName, scopes);
}
