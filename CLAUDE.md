# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コマンド

```bash
# 開発サーバー起動（クライアント + サーバー個別）
npm run dev:client      # Vite dev server → http://localhost:5173
npm run dev:server      # tsx watch mode → http://localhost:3000
npm run dev:functions   # Cloudflare Pages Functions ローカル実行

# Lint / Format
npm run check       # Biome でチェックのみ
npm run fix:safe    # 安全な自動修正（pre-commit フックで自動実行）
npm run fix         # unsafe 修正も含む

# ビルド
cd client && npm run build        # 本番ビルド
cd server && npm run build        # サーバービルド

# データベース
docker compose up -d postgres                  # ローカル DB 起動
cd server && npx prisma migrate dev            # マイグレーション実行
cd server && npx prisma generate               # Prisma Client 再生成
```

## アーキテクチャ

### モノレポ構成

```
common/    共有 Zod スキーマと色ユーティリティ
client/    React 19 + Vite フロントエンド
server/    Hono + Prisma バックエンド
```

### 型安全な API クライアント

クライアントは `hono/client` による RPC で型安全にサーバーと通信する。サーバーの `AppType` を直接 import することで、エンドポイントの型が共有される。

```ts
// client/src/pages/eventId/Submission.tsx
import type { AppType } from "../../../../server/src/main";
const client = hc<AppType>(API_ENDPOINT);
```

REST fetch ではなく `client.projects[":projectId"].$get(...)` 形式で呼び出す。

### 認証（browserId）

ユーザーアカウントなし。サーバーの `browserIdMiddleware` が、初回アクセス時に UUID を生成して署名付き Cookie として保存し、以降のリクエストでは Cookie から `browserId` を復元して `c.set("browserId", ...)` に格納する。Express から Hono への移行時に Cookie の署名形式が変わったため、ミドルウェアは両形式に対応している（`server/src/middleware/browserId.ts`）。

### カレンダーの状態管理（CalendarMatrix）

`client/src/lib/CalendarMatrix.ts` に核となるデータ構造がある。カレンダーの選択状態は 2D 行列で管理される（行=日、列=15分単位のスロット）：

- **`EditingMatrix`**: 自分の入力中スロット。セル値は `participationOptionId`（文字列）。
- **`ViewingMatrix`**: 全ゲストの既存スロット。セル値は `{ [guestId]: optionId }` のレコード。

どちらも `getSlots()` で連続するセルをまとめてイベント単位に変換（run-length encoding 的な処理）して返す。

`Calendar.tsx` はこのマトリックスを `useRef` で保持し、スロット変更時に `editingSlots → matrix → CalendarEvent[]` の順で再計算して FullCalendar に渡す。

### dayjs のインポート制限

`dayjs` は `lib/dayjs.ts` 経由で使うこと（Biome のカスタムルールで強制）。このファイルで UTC・timezone プラグインを有効化し、デフォルトタイムゾーンを `Asia/Tokyo` に設定している。カレンダーの座標計算がタイムゾーンに依存するため直接 import すると不具合が起きる。

```ts
// NG
import dayjs from "dayjs";
// OK
import dayjs from "../lib/dayjs";
```

### 参加形態（ParticipationOption）の流れ

- 作成時: フロントエンドで `crypto.randomUUID()` を生成して `id` を確定。サーバーは受け取った id をそのまま使用。
- デフォルト: 参加形態が0件の場合は `common/colors.ts` の `DEFAULT_PARTICIPATION_OPTION` を使用してデフォルトを自動作成（label: "参加", color: "#0F82B1"）。
- 削除制限: Slot が紐づいている参加形態は削除不可（サーバー側で検証）。

### Cloudflare Pages Functions

`client/functions/[[path]].ts` が catch-all ルートとして動作し、`/e/:eventId` パターンの OG メタタグを動的に書き換える。ローカル確認は `npm run dev:functions` を使う（`npm run dev:client` の Vite dev server では Functions は動作しない）。
