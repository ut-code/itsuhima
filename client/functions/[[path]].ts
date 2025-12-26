/// <reference types="@cloudflare/workers-types" />

interface Env {
  API_ENDPOINT: string;
}

interface ProjectData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  allowedRanges: Array<{
    id: string;
    projectId: string;
    startTime: string;
    endTime: string;
  }>;
}

class OGTitleRewriter {
  private title: string;

  constructor(title: string) {
    this.title = title;
  }

  element(element: Element) {
    if (element.getAttribute("property") === "og:title") {
      element.setAttribute("content", this.title);
    }
  }
}

class OGDescriptionRewriter {
  private description: string;

  constructor(description: string) {
    this.description = description;
  }

  element(element: Element) {
    if (element.getAttribute("property") === "og:description") {
      element.setAttribute("content", this.description);
    }
  }
}

class OGImageRewriter {
  private imageUrl: string;

  constructor(imageUrl: string) {
    this.imageUrl = imageUrl;
  }

  element(element: Element) {
    if (element.getAttribute("property") === "og:image") {
      element.setAttribute("content", this.imageUrl);
    }
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  })
    .format(date)
    .replace(/-/g, "/");
}

// プロジェクト情報を取得
async function fetchProjectData(eventId: string, apiEndpoint: string): Promise<ProjectData | null> {
  try {
    const response = await fetch(`${apiEndpoint}/projects/${eventId}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch project data:", error);
    return null;
  }
}

function isValidEventPath(path: string): boolean {
  // 新パス /e/eventId または 旧パス /eventId の形式で、eventId が21文字の英数字・ハイフン・アンダースコア
  const match = path.match(/^\/(?:e\/)?([A-Za-z0-9_-]{21})$/);
  return !!match;
}

function extractEventId(path: string): string | null {
  // 新パス /e/eventId または 旧パス /eventId から eventId を抽出
  const match = path.match(/^\/(?:e\/)?([A-Za-z0-9_-]{21})$/);
  return match ? match[1] : null;
}

// biome-ignore lint/suspicious/noExplicitAny: This is a Cloudflare Worker context
export async function onRequest(context: EventContext<Env, any, any>): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 静的アセットや API ルートは通常通り処理
  if (
    path.startsWith("/assets/") ||
    path.startsWith("/api/") ||
    path.startsWith("/public/") ||
    path.includes(".") // ファイル拡張子がある場合
  ) {
    return await next();
  }

  if (!isValidEventPath(path)) {
    return await next();
  }

  const eventId = extractEventId(path);
  if (!eventId) {
    return await next();
  }

  // 元のHTMLレスポンスを取得
  const response = await next();

  const contentType = response.headers.get("content-type");

  // 304 Not Modified や HTML でない場合はスキップ
  if (response.status === 304 || (!contentType?.includes("text/html") && contentType !== null)) {
    return response;
  }

  const projectData = await fetchProjectData(eventId, env.API_ENDPOINT);

  const defaultOgImageUrl = `${url.origin}/og-image.jpg`;

  if (!projectData) {
    // プロジェクトが見つからない場合はデフォルト画像を設定
    return new HTMLRewriter()
      .on('meta[property="og:image"]', new OGImageRewriter(defaultOgImageUrl))
      .transform(response);
  }

  const ogTitle = `${projectData.name} - イツヒマ`;

  const startDate = formatDate(projectData.startDate);
  const endDate = formatDate(projectData.endDate);
  const dateRange = startDate === endDate ? startDate : `${startDate} 〜 ${endDate}`;
  const ogDescription = `日程範囲: ${dateRange}`;

  const ogImageUrl = `${url.origin}/og/${eventId}`;

  return new HTMLRewriter()
    .on('meta[property="og:title"]', new OGTitleRewriter(ogTitle))
    .on('meta[property="og:description"]', new OGDescriptionRewriter(ogDescription))
    .on('meta[property="og:image"]', new OGImageRewriter(ogImageUrl))
    .transform(response);
}
