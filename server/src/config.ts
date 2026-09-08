const isProduction = process.env.NODE_ENV === "prod";

export const cookieOptions = {
  path: "/",
  domain: process.env.DOMAIN || "localhost", // /home へのリダイレクトのためフロントエンドにも送る
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365, // Express だとミリ秒だったが、Hono では秒らしい
} as const;
