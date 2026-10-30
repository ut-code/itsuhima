import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { indexHtml, login, requestWorker } from "./helpers.js";

/** Set-Cookie を、ブラウザのように Cookie の束に反映する (Max-Age=0 なら消す) */
function applySetCookies(jar: Map<string, string>, res: Response) {
  for (const header of res.headers.getSetCookie()) {
    const [pair] = header.split(";");
    const name = pair.slice(0, pair.indexOf("="));
    if (/Max-Age=0/i.test(header)) jar.delete(name);
    else jar.set(name, pair);
  }
}

function openLanding(jar: Map<string, string>) {
  return requestWorker("/", { headers: { Cookie: [...jar.values()].join("; ") } });
}

describe("GET /", () => {
  test("Cookie が無ければ、ランディングページ (index.html) を返す", async () => {
    const res = await requestWorker("/");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(indexHtml);
  });

  test("ログインしていれば (セッションの Cookie があれば) /home にリダイレクトする", async () => {
    for (const name of ["better-auth.session_token", "__Secure-better-auth.session_token"]) {
      const res = await requestWorker("/", { headers: { Cookie: `${name}=xxx` } });

      expect(res.status, name).toBe(302);
      expect(res.headers.get("Location")).toBe("/home");
    }
  });

  test("ゲストの Cookie では、リダイレクトしない (ゲストは client が控えで決める)", async () => {
    for (const cookie of ["browserId=xxx", "visited=1", "itsuhima.hint=xxx"]) {
      const res = await requestWorker("/", { headers: { Cookie: cookie } });

      expect(res.status, cookie).toBe(200);
    }
  });
});

describe("ログインしてから初めの状態に戻る", () => {
  for (const [label, path] of [
    ["ログアウト", "/api/auth/sign-out"],
    ["アカウントの削除", "/api/auth/delete-user"],
  ]) {
    test(`ログイン → ${label} → / が LP に戻る`, async () => {
      const user = await login({ sub: `google-${label}` });
      const jar = new Map(user.cookies.map((c) => [c.slice(0, c.indexOf("=")), c]));
      expect((await openLanding(jar)).status).toBe(302);

      const res = await requestWorker(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: env.PUBLIC_ORIGIN,
          Cookie: [...jar.values()].join("; "),
        },
        body: "{}",
      });
      expect(res.status).toBe(200);
      applySetCookies(jar, res);

      expect([...jar.keys()]).toEqual([]);
      expect((await openLanding(jar)).status).toBe(200);
    });
  }
});
