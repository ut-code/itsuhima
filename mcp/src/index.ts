#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
/**
 * イツヒマの MCP サーバー（POST /mcp）に stdio で接続するためのブリッジ。
 *
 * サーバーは stateless な Streamable HTTP で、レスポンスは常に単一の JSON。
 * したがってここは「stdin の JSON-RPC メッセージを HTTP に載せ替え、
 * レスポンスを stdout に書き戻す」だけでよい。ツール定義は一切持たない。
 */
import { createInterface } from "node:readline";

const API_ORIGIN = (process.env.ITSUHIMA_API ?? "https://api.itsuhima.utcode.net").replace(/\/+$/, "");
const CONFIG_PATH = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "itsuhima-mcp", "token.json");

/** stderr にだけ書く。stdout は JSON-RPC 専用なので混ぜてはいけない。 */
function log(message: string): void {
  process.stderr.write(`[itsuhima-mcp] ${message}\n`);
}

async function readSavedToken(): Promise<string | null> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

async function saveToken(token: string): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  // トークンは本人以外が読めないようにする
  await writeFile(CONFIG_PATH, `${JSON.stringify({ token }, null, 2)}\n`, { mode: 0o600 });
  log(`API トークンを ${CONFIG_PATH} に保存しました。`);
}

/** 連携コードを API トークンに引き換える */
async function redeemPairingCode(code: string): Promise<string> {
  const res = await fetch(`${API_ORIGIN}/mcp/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, client_name: `itsuhima-mcp (${process.platform})` }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `連携コードの引き換えに失敗しました（HTTP ${res.status}）。`);
  }

  const { token } = (await res.json()) as { token: string };
  return token;
}

async function resolveToken(): Promise<string> {
  if (process.env.ITSUHIMA_TOKEN) return process.env.ITSUHIMA_TOKEN;

  const saved = await readSavedToken();
  if (saved) return saved;

  const code = process.env.ITSUHIMA_PAIRING_CODE;
  if (!code) {
    throw new Error(
      "認証情報がありません。イツヒマの「AI 連携」画面で連携コードを発行し、" +
        "環境変数 ITSUHIMA_PAIRING_CODE に設定して起動し直してください。",
    );
  }

  const token = await redeemPairingCode(code);
  await saveToken(token);
  return token;
}

async function main(): Promise<void> {
  const token = await resolveToken();
  const endpoint = `${API_ORIGIN}/mcp`;
  log(`${endpoint} に接続します。`);

  const rl = createInterface({ input: process.stdin });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        body: trimmed,
      });

      // 通知（notification）には本文が無い
      if (res.status === 202 || res.headers.get("content-length") === "0") continue;

      const body = await res.text();
      if (!body) continue;

      if (!res.ok) {
        // HTTP レベルのエラーは JSON-RPC エラーに包み直して、クライアントが黙り込まないようにする
        const id = (JSON.parse(trimmed) as { id?: unknown }).id ?? null;
        const message = (JSON.parse(body) as { message?: string }).message ?? body;
        process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } })}\n`);
        continue;
      }

      process.stdout.write(`${body.trim()}\n`);
    } catch (error) {
      log(`リクエストに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

main().catch((error: unknown) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
