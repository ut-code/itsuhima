/// <reference types="@cloudflare/workers-types" />

interface Env {
  API_ENDPOINT: string;
}

// biome-ignore lint/suspicious/noExplicitAny: This is a Cloudflare Worker context
export async function onRequest(context: EventContext<Env, any, any>): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const backendUrl = env.API_ENDPOINT + url.pathname.replace(/^\/api/, "") + url.search;

  const proxied = new Request(backendUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "manual",
  });

  const response = await fetch(proxied);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
