/** リンクのプレビュー (OG) に出すイベントの情報 */
export type EventPreview = { id: string; name: string; startDate: string; endDate: string };

/** "YYYY-MM-DD" を "YYYY/MM/DD" にする */
function formatDate(date: string) {
  return date.replace(/-/g, "/");
}

/** "2026/11/02 〜 2026/11/04"。1 日だけなら "2026/11/02" */
export function formatDateRange(event: EventPreview) {
  const start = formatDate(event.startDate);
  const end = formatDate(event.endDate);
  return start === end ? start : `${start} 〜 ${end}`;
}

/**
 * OG 画像の版。画像に描く内容 (名前と日程) から作る。
 * OG 画像の URL に付けて、内容が変わったら別の URL (別のキャッシュ) になるようにする。
 */
export async function ogImageVersion(event: EventPreview) {
  const data = new TextEncoder().encode(JSON.stringify([event.name, event.startDate, event.endDate]));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** OG 画像の URL */
export async function ogImageUrl(origin: string, event: EventPreview) {
  return `${origin}/og/${event.id}?v=${await ogImageVersion(event)}`;
}
