# itsuhima-mcp

イツヒマの MCP サーバーに Claude Code / Claude Desktop / Cursor から stdio で接続するためのブリッジ。

ツールの定義・権限判定・集計はすべてサーバー側（`POST /mcp`）にあり、このパッケージは
JSON-RPC メッセージを中継するだけ。ロジックを二重に持たないための構成。

**利用できるツールや認証の仕様は [`docs/mcp.md`](../docs/mcp.md) を参照。**
ここには接続手順だけを書く。

## 設定

イツヒマの「AI 連携」画面（`/settings/mcp`）で連携コードを発行し、次を設定ファイルに追加する。

```json
{
  "mcpServers": {
    "itsuhima": {
      "command": "npx",
      "args": ["-y", "itsuhima-mcp"],
      "env": { "ITSUHIMA_PAIRING_CODE": "123456" }
    }
  }
}
```

連携コードは初回起動時に API トークンへ引き換えられ、`~/.config/itsuhima-mcp/token.json`
に保存される（パーミッション 600）。以降はコードなしで起動できるので、設定から
`ITSUHIMA_PAIRING_CODE` を消してよい。

既にトークンを持っている場合は `ITSUHIMA_TOKEN` を直接指定してもよい。

## 環境変数

| 変数 | 既定値 | 説明 |
|---|---|---|
| `ITSUHIMA_PAIRING_CODE` | なし | 連携コード（6 桁）。初回のみ必要 |
| `ITSUHIMA_TOKEN` | なし | API トークン。指定すると保存済みトークンより優先される |
| `ITSUHIMA_API` | `https://api.itsuhima.utcode.net` | 接続先。ローカル開発では `http://localhost:3000` |

## 開発

```sh
npm run build   # tsc
npm run dev     # tsx src/index.ts
```

stdout は JSON-RPC 専用なので、ログは必ず stderr に書くこと。
