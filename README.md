# イツヒマ

![ロゴ](./logo.png)

## 概要

とりあえずみんなの空いている時間を訊いてから、何を何時間やるか決めたい。そんな仲間うちでの日程調整に最適なツールです。

## 開発

### 要件

- Node.js
- npm
- Docker (開発用 DB のみに使用)

### セットアップ

依存関係のインストール

```sh
npm ci
```

Prisma Client の生成

```sh
cd server
npx prisma generate
```

`server/.env.sample` をコピーして `server/.env` を作成

`client/.env.local.sample` をコピーして `client/.env.local` を作成
### 起動

開発用データベースの起動

```sh
docker compose up
```

サーバー側とクライアント側をそれぞれ起動

```sh
npm run dev:server
```

```sh
npm run dev:client
```

cloudflare functions が必要な場合

```sh
npm run dev:functions
```

http://localhost:5173 にアクセスします。



### コードスタイル

コードのリント・フォーマット

```sh
npm run check
npm run fix
```
