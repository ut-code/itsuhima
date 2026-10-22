import { createAuthClient } from "better-auth/react";

/** ログイン (Google) を出すか。準備ができるまでは、環境ごとに隠しておける */
export const LOGIN_ENABLED = import.meta.env.VITE_LOGIN_ENABLED === "true";

/** Better Auth のクライアント。API と同じオリジンの /api/auth を呼ぶ */
export const authClient = createAuthClient({ basePath: "/api/auth" });
