import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        // 本番以外のビルドは、タブでも見分けられるようにタイトルにラベルを付ける
        name: "env-label-title",
        transformIndexHtml: (html) =>
          env.VITE_ENV_LABEL ? html.replace("<title>", `<title>[${env.VITE_ENV_LABEL}] `) : html,
      },
    ],
    server: {
      allowedHosts: env.VITE_ALLOWED_HOSTS?.split(",").filter(Boolean) ?? [],
      // 本番と同じく、API を同じオリジンの /api で呼ぶ。wrangler dev (server) に転送する
      proxy: {
        "/api": "http://localhost:3000",
        // MCP サーバーと、OAuth のメタデータ
        "/mcp": "http://localhost:3000",
        "/.well-known": "http://localhost:3000",
      },
    },
  };
});
