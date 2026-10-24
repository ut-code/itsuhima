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
- `server/wrangler.toml` の `run_worker_first` に当たるパスだけ Worker を通る:
  - `/api/*`: API (`server/src/app.ts`)
  - `/e/:eventId`: `index.html` の OG メタタグにイベント名と日程を入れる (`server/src/routes/pages.ts`)
  - `/og/:eventId`: OG 画像を生成し、Cache API にキャッシュする (`server/src/routes/ogImage.tsx`。重いので動的に import する)
  - `/`: 使ったことがあれば (browserId の Cookie があれば) `/home` にリダイレクトする

### 型安全な API クライアント

クライアントは `hono/client` による RPC で型安全にサーバーと通信する。サーバーの `AppType` (API の型) を直接 import することで、エンドポイントの型が共有される。import するのは `server/src/app.ts` (API だけ)。`main.ts` は OG 画像なども含むので、client の型チェックに入れない。

```ts
// client/src/pages/eventId/Submission.tsx
import type { AppType } from "../../../../server/src/app";
const client = hc<AppType>(API_ENDPOINT); // API_ENDPOINT は "/api"
```

REST fetch ではなく `client.events[":eventId"].$get(...)` 形式で呼び出す。

### データモデル（D1）

`server/src/db/schema.ts`。テーブル名は小文字の単数形・camelCase。

- `event`: 日程調整のイベント。`startDate` / `endDate` は `"YYYY-MM-DD"`（`endDate` を含む）、`timezone` は IANA のタイムゾーン名（現在は全件 `Asia/Tokyo`）。
- `allowedRange`: 入力できる時間帯（現在はイベントにつき 1 つ）。`startTime` / `endTime` は `"HH:mm"`。終わりは `"24:00"` もありうる。
- `option`: 参加形態。
- `participant`: 参加者。`role` でホストとゲストを区別する。`name` が null なら未回答（イベントを作っただけのホスト）。ホストが回答しても 1 行のまま。持ち主はブラウザ（`browserId`）かユーザー（`userId`）のどちらか一方で、もう一方は null（CHECK 制約）。ユーザーを削除すると両方とも null になり、回答は残るが誰も操作できない。未回答はホストだけで、ホストはイベントにつき 1 人（CHECK 制約と部分 UNIQUE インデックス）。
- `slot`: 参加者が参加できる時間帯。`startAt` / `endAt` は UTC の ISO 8601 で、日をまたがない。

日付と時間帯は、イベントの `timezone` の壁時計の値で持つ。Slot だけは実際の時刻なので UTC で持つ。API も同じ形式で受け取って返す。

API のレスポンスでは、参加者を `hosts`（ホスト）、`guests` と `meAsGuest`（回答した参加者）に分けて返し、Slot の参加者 ID は `guestId` として返す。

マイグレーションは `server/migrations/`。データの変換を伴うものは `drizzle-kit generate --custom` で作って SQL を手で書き、`server/test/migrations.test.ts` に移行のテストを足す。D1 は外部キーを常に強制し、`DROP TABLE` の暗黙の DELETE で `ON DELETE CASCADE` が発火するので、他のテーブルから参照されるテーブルは作り直さない（`RENAME` や `ADD COLUMN` で変える）。

### 本人の判定（browserId とログイン）

ログインは任意。ログインしなくても、ブラウザごとの `browserId` で作成・回答できる。

**browserId**: サーバーの `browserIdMiddleware` が、初回アクセス時に UUID を生成して署名付き Cookie として保存し、以降のリクエストでは Cookie から `browserId` を復元して `c.set("browserId", ...)` に格納する。署名鍵は `COOKIE_SECRET`。ローテーション中は `COOKIE_SECRET_PREVIOUS` の鍵でも検証し、現行の鍵で署名し直す（`server/src/middleware/browserId.ts`）。

**ログイン (Google)**: Better Auth を `/api/auth/*` に載せている（`server/src/auth.ts`）。Workers では env がリクエストの中でしか取れないので、`createAuth(env, db)` をリクエストごとに呼ぶ。テーブル (`user`/`session`/`account`/`verification`) は `server/auth.config.ts` から `npx auth generate` で生成したもの。

- `actorMiddleware` が、操作する本人 `Actor = { browserId, userId }` を `c.set("actor", ...)` に入れる。セッションの Cookie が無ければ Better Auth を作らない。
- サービスは `Actor` を受け取る。参加者は、`userId` か `browserId` が一致すれば本人のもの（`services/actor.ts` の `ownedBy` / `pickMine`）。ログインしたまま作る参加者はユーザーのもの（`ownerOf`）。
- ログインすると、そのブラウザの参加者をユーザーのものにする（`userId` を付け、`browserId` を null にする。`services/link.ts`）。別の端末でも同じユーザーとしてログインすれば、同じ参加者を操作できる。ログアウトしたり、同じブラウザで別の人がログインしたりしても、ユーザーの参加者には触れない。
- アカウントは削除できる（Better Auth の `deleteUser`）。作ったイベントと回答は残す。パスワードがないので、ログインして 1 日以内のセッションでだけ消せる。
- client のログインのボタンは `VITE_LOGIN_ENABLED=true` のときだけ出る。
- テストでは `createBrowser().login(...)` でログインできる（Google を呼ばず、署名なしの ID トークンを使う）。

### カレンダーの状態管理（CalendarMatrix）

`client/src/lib/CalendarMatrix.ts` に核となるデータ構造がある。カレンダーの選択状態は 2D 行列で管理される（行=日、列=15分単位のスロット）：

- **`EditingMatrix`**: 自分の入力中スロット。セル値は参加形態の id（文字列）。
- **`ViewingMatrix`**: 全ゲストの既存スロット。セル値は `{ [guestId]: optionId }` のレコード。
- **`HighlightMatrix`**: 「最多人数」や特定のゲストの強調表示に使う、条件を満たすセル。

いずれも `getSlots()` で連続するセルをまとめて区間に変換（run-length encoding 的な処理）して返す。

`Calendar.tsx` は `EditingMatrix` を `useRef` で保持し、`editingSlots` が変わると行列を作り直して区間を再計算する。`ViewingMatrix` は `viewingSlots` から `useMemo` で作る。どちらの区間も、グリッドの上に絶対配置で直接描画する。区間の終わりは 24:00（翌日の 0:00）になりうるので、位置は開始からの経過時間で求める。

### dayjs のインポート制限

`dayjs` は `lib/dayjs.ts` 経由で使うこと（Biome のカスタムルールで強制）。このファイルで UTC・timezone プラグインを有効化し、デフォルトタイムゾーンを `Asia/Tokyo` に設定している。カレンダーの座標計算がタイムゾーンに依存するため直接 import すると不具合が起きる。

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
