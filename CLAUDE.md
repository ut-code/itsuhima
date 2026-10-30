# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コマンド

```bash
# 開発サーバー起動（クライアント + サーバー個別）
npm run dev:client      # Vite dev server → http://localhost:5173 (/api は wrangler dev に転送)
npm run dev:server      # wrangler dev (Workers + ローカル D1) → http://localhost:3000
npm run dev:worker      # client をビルドして wrangler dev。画面も Worker から配信 (本番と同じ構成) → http://localhost:3000

# Lint / Format
npm run check       # Biome でチェックのみ
npm run fix:safe    # 安全な自動修正（pre-commit フックで自動実行）
npm run fix         # unsafe 修正も含む

# ビルド
cd server && npm run build        # client をビルドしてから wrangler deploy --dry-run
cd server && npm run deploy       # 本番にデプロイ (deploy:staging でステージング)

# テスト (server、Workers ランタイム + ローカル D1)
cd server && npm test

# データベース (D1 + Drizzle)
cd server && npm run db:generate               # schema.ts の変更からマイグレーションを生成
cd server && npm run db:migrate:local          # ローカル D1 に適用
```

ローカルの D1 (`server/.wrangler/state/v3/d1`) は使い捨てで、データを保持しなくてよい。消したら `npm run db:migrate:local` で作り直す。

## アーキテクチャ

### モノレポ構成

```
common/    共有 Zod スキーマと色ユーティリティ
client/    React 19 + Vite フロントエンド
server/    Hono + Drizzle バックエンド (Cloudflare Workers + D1)。client のビルド結果も静的アセットとして配信する
```

### Worker の構成

1 つの Worker (`server/src/main.ts`) が、画面と API を同じオリジンで配信する。

- 静的アセット (`client/dist`) は Worker を通らずに配信する。SPA のパスは `index.html` になる。
- `server/wrangler.toml` の `run_worker_first` に当たるパスだけ Worker を通る。`main.ts` はパスの最初の区切りだけで振り分け、1 行を `run_worker_first` の 1 項目に対応させる。`server/src/routes/` の各ファイルは自分のプレフィックスより下だけを受け持ち、受け持ちは重ならない (ハンドラが 1 つだけなら Hono のルーターにせず、関数を `.get` で載せる)。ルートを足すときは両方に足す:
  - `/`: 使ったことがあれば (`visited` の Cookie があれば) `/home` にリダイレクトする (`landing.ts`)
  - `/e/:eventId`: `index.html` の OG メタタグにイベント名と日程を入れる (`eventPage.ts`)
  - `/og/:eventId`: OG 画像を生成し、Cache API にキャッシュする (`ogImage.tsx`。画像を作るライブラリ (`@cloudflare/pages-plugin-vercel-og`) は初期化が重いので、作るときだけ動的に import する)
  - `/api/*`: API (`api.ts`。`/api/auth/*` は Better Auth (Google ログインと、MCP 向けの OAuth の認可サーバー、`server/src/auth.ts`))
  - `/mcp`・`/mcp/*`: MCP (`mcp.ts`。`/mcp` は OAuth、`/mcp/public` は認証なし。ツールは `server/src/mcp/`、仕様は `docs/mcp.md`)
  - `/.well-known/*`: OAuth のメタデータ (`wellKnown.ts`)

Better Auth も大きいので、使うときだけ動的に import する (セッションの Cookie が無いリクエストでは作らない)。

wrangler はバンドルを分割しないので、動的 import で遅れるのはモジュールの初期化 (起動時間) だけで、バンドルの大きさは変わらない。重い本体を `routes/` の薄いファイルから動的に import し、`main.ts` は割り振りだけにする。

### 型安全な API クライアント

クライアントは `hono/client` による RPC で型安全にサーバーと通信する。サーバーの `AppType` (API の型) を直接 import することで、エンドポイントの型が共有される。import するのは `server/src/routes/api.ts` (API だけ)。`main.ts` は OG 画像なども含むので、client の型チェックに入れない。

```ts
// client/src/pages/eventId/Submission.tsx
import type { AppType } from "../../../../server/src/routes/api";
const client = hc<AppType>(API_ENDPOINT); // API_ENDPOINT は "/api"
```

REST fetch ではなく `client.events[":eventId"].$get(...)` 形式で呼び出す。

### データモデル（D1）

`server/src/db/schema.ts`。テーブル名は小文字の単数形・camelCase。

- `event`: 日程調整のイベント。`startDate` / `endDate` は `"YYYY-MM-DD"`（`endDate` を含む）、`timezone` は IANA のタイムゾーン名（現在は全件 `Asia/Tokyo`）。
- `allowedRange`: 入力できる時間帯（現在はイベントにつき 1 つ）。`startTime` / `endTime` は `"HH:mm"`。終わりは `"24:00"` もありうる。
- `option`: 参加形態。
- `event.ownerUserId` / `participant.userId`: ログインして作った人・回答した人。null は匿名。ユーザーを削除すると null になる。
- `participant`: 回答。名前の重複は許す。ログインした人は、1 つのイベントに 1 つだけ。
- `slot`: 参加者が参加できる時間帯。`startAt` / `endAt` は UTC の ISO 8601 で、日をまたがない。
- `history`: イベントの設定と回答を変える・消す前のスナップショット。履歴から戻すのに使う。
- `user` / `session` / `account` / `verification`、`jwks`、`oauth*`: Better Auth (`npx auth generate` で生成。手で変えない)。個人情報を持たないよう、Google の `sub` は HMAC (鍵は `ACCOUNT_ID_SECRET`) にして保存し、ほかは保存しない (`server/src/auth.ts`)。メールアドレスは、ログイン中のアカウントを示すためだけに受け取り、暗号化した Cookie に入れる (`server/src/lib/accountEmail.ts`)。
- `legacyBrowserEvent`: 前の browserId で作ったイベントと回答したイベント。前の一覧を client の控えに移す (交換する) ためだけに残す。

日付と時間帯は、イベントの `timezone` の壁時計の値で持つ。Slot だけは実際の時刻なので UTC で持つ。API も同じ形式で受け取って返す。

API のレスポンスでは、イベントと回答に、編集できるか (`canEdit`) を付けて返す。

マイグレーションは `server/migrations/`。データの変換を伴うものは `drizzle-kit generate --custom` で作って SQL を手で書き、`server/test/migrations.test.ts` に移行のテストを足す。D1 は外部キーを常に強制し、`DROP TABLE` の暗黙の DELETE で `ON DELETE CASCADE` が発火するので、他のテーブルから参照されるテーブルは作り直さない（`RENAME` や `ADD COLUMN` で変える）。

### 権限と本人

ログインは任意 (Google)。ログインしない人の権限は、URL を知っていることだけ。サーバーはブラウザを識別せず、本人を表す Cookie はログインのセッションだけ。

- 匿名のイベントと回答は、URL を知っている人は誰でも編集・削除できる。ログインして作ったイベントは持ち主だけ、ログインして出した回答はその人だけが編集できる (イベントの持ち主は、回答を消すことだけできる)。間違えて変えたときのために、論理削除と変更の履歴 (戻せる人は、編集できる人と同じ) と、書き込みのレート制限がある。
- 本人は `Actor = { userId: string | null }` で表し (`middleware/actor.ts` がセッションから決める)、判定は `server/src/services/permissions.ts` の `canEditEvent` / `canEditParticipant` / `canDeleteParticipant` に集める。API は持ち主の id を返さず、`canEdit`・`hasOwner`・`isMine` だけを返す。
- 「自分が作ったイベント・回答したイベント」は、client が localStorage に控える (`client/src/lib/myEvents.ts`)。ホームの一覧はこの控えと、ログインしていれば `GET /api/me/events` から出す。控えは権限には使わない。
- 前の browserId の Cookie は、交換の口 (`POST /api/legacy/exchange`、`server/src/routes/legacy.ts`) だけが読む。署名鍵は `COOKIE_SECRET` (ローテーション中は `COOKIE_SECRET_PREVIOUS` も)。

### カレンダーの状態管理（CalendarMatrix）

`client/src/lib/CalendarMatrix.ts` に核となるデータ構造がある。カレンダーの選択状態は 2D 行列で管理される（行=日、列=15分単位のスロット）：

- **`EditingMatrix`**: 自分の入力中スロット。セル値は参加形態の id（文字列）。
- **`ViewingMatrix`**: 全回答の既存スロット。セル値は `{ [participantId]: optionId }` のレコード。
- **`HighlightMatrix`**: 「最多人数」や特定のゲストの強調表示に使う、条件を満たすセル。

いずれも `getSlots()` で連続するセルをまとめて区間に変換（run-length encoding 的な処理）して返す。

`Calendar.tsx` は `EditingMatrix` を `useRef` で保持し、`editingSlots` が変わると行列を作り直して区間を再計算する。`ViewingMatrix` は `viewingSlots` から `useMemo` で作る。どちらの区間も、グリッドの上に絶対配置で直接描画する。区間の終わりは 24:00（翌日の 0:00）になりうるので、位置は開始からの経過時間で求める。

### dayjs のインポート制限

`dayjs` は `lib/dayjs.ts` 経由で使うこと（Biome の `noRestrictedImports` で強制。`lib/dayjs.ts` だけ `biome-ignore` で許している）。このファイルで UTC・timezone プラグインを有効化し、デフォルトタイムゾーンを `Asia/Tokyo` に設定している。カレンダーの座標計算がタイムゾーンに依存するため直接 import すると不具合が起きる。

```ts
// NG
import dayjs from "dayjs";
// OK
import dayjs from "../lib/dayjs";
```

### 参加形態（option）の流れ

- 作成時: フロントエンドで `crypto.randomUUID()` を生成して `id` を確定。サーバーは受け取った id をそのまま使用。
- デフォルト: イベントの作成フォームの初期値に、`common/colors.ts` の `DEFAULT_PARTICIPATION_OPTION`（label: "参加", color: "#0F82B1"）を 1 つ入れる。API は参加形態を最低 1 つ要求する。
- 削除制限: Slot が紐づいている参加形態は削除不可（サーバー側で検証）。
