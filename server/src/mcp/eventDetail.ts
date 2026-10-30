import { findCandidates, summarizeAvailability } from "../lib/availability.js";
import { getEvent } from "../services/events.js";
import { eventUrl, isLoggedIn, type McpContext } from "./context.js";
import { serviceErrorResult } from "./errors.js";
import { formatDate, formatInterval, formatNow, sanitize, toolError, untrustedBlock } from "./format.js";
import { INVALID_EVENT_URL_MESSAGE, parseEventId } from "./schemas.js";

/** 削除されていないイベントの詳細 */
export type EventDetail = Extract<Awaited<ReturnType<typeof getEvent>>, { status: "active" }>["event"];

type ToolError = ReturnType<typeof toolError>;

/** get_event で出す集計の件数 */
const TOP_CANDIDATES = 5;
/** 一度に出す参加者の上限 */
const PARTICIPANT_PAGE_SIZE = 50;

/**
 * URL (または ID) からイベントを読む。読めない (URL の形が違う、無い、削除されている) ときは、ツールのエラーを返す。
 */
export async function loadEvent(ctx: McpContext, urlOrId: string): Promise<{ event: EventDetail } | ToolError> {
  const eventId = parseEventId(urlOrId);
  if (!eventId) return toolError(INVALID_EVENT_URL_MESSAGE);
  try {
    const result = await getEvent(ctx.db, ctx.actor, eventId);
    if (result.status === "deleted") {
      return toolError(
        `このイベントは削除されています。${formatNow("Asia/Tokyo", new Date(result.event.purgeAt))} に完全に消えます。` +
          `それまでは、${eventUrl(ctx, eventId)} を Web で開くと戻せます。そのことをユーザーに伝えてください。`,
      );
    }
    return { event: result.event };
  } catch (e) {
    return serviceErrorResult(e);
  }
}

/** 回答を、集計の入力の形にする */
export function availabilityOf(event: EventDetail) {
  return summarizeAvailability(
    event,
    event.participants.map((p) => ({ id: p.id, name: p.name, slots: p.slots })),
  );
}

/** 集計の人数の数え方の注記。回答が 1 人だけなら、それも書く */
export function headcountNotes(event: EventDetail): string[] {
  return [
    "人数は回答した人の中で数える。まだ回答していない人は数に入らない (招いた人数は分からない)。",
    "参加形態は区別せずに数える。参加形態ごとの内訳は、各行の括弧の中にある。",
    ...(event.participants.length === 1 ? ["まだ 1 人しか回答していないので、みんなの共通の時間帯とは言えない。"] : []),
  ];
}

/** 候補の時間帯の 1 行 ("1. 2026-11-02(月) 10:00〜12:00 — 2 人 / 回答した 3 人中 (option <id>: 2 人)") */
export function formatCandidate(
  candidate: { startAt: string; endAt: string; members: { optionId: string }[] },
  rank: number,
  event: EventDetail,
): string {
  return `${rank}. ${formatInterval(candidate, event.timezone)} — ${candidate.members.length} 人 / 回答した ${event.participants.length} 人中 (${formatByOption(candidate.members)})`;
}

/** 参加形態ごとの人数 ("option <id>: 2 人, option <id>: 1 人") */
function formatByOption(members: { optionId: string }[]): string {
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.optionId, (counts.get(m.optionId) ?? 0) + 1);
  return [...counts].map(([optionId, count]) => `option ${optionId}: ${count} 人`).join(", ");
}

/** 登録した時間帯を、時刻の順に 1 行ずつ */
export function formatSlots(slots: { startAt: string; endAt: string; optionId: string }[], timezone: string) {
  return [...slots]
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((s) => `${formatInterval(s, timezone)} [option ${s.optionId}]`);
}

/** イベントの設定を変えられる人 */
function editorsOf(ctx: McpContext, event: EventDetail) {
  if (!event.hasOwner) {
    return "ログインせずに作られたイベント。URL を知っている人は誰でも、設定を変えたり削除したりできる (変更は Web の履歴から戻せる)。";
  }
  if (event.canEdit) {
    return isLoggedIn(ctx)
      ? "あなた (ログインしているユーザー) が作ったイベント。設定の変更と削除は、あなただけができる。"
      : "ログインした人が作ったイベント。";
  }
  return "ログインした人が作ったイベント。設定の変更と削除は、作った人だけができる (update_event・delete_event は使えない)。";
}

/** 回答の、誰が変えられるかの注記 */
function participantNote(p: EventDetail["participants"][number]) {
  if (p.isMine) return " / あなたの回答 (直すときは update_availability にこの participant_id を渡す)";
  return p.canEdit ? "" : " / ログインした人の回答 (その人だけが直せる)";
}

/**
 * イベントの詳細 (get_event、create_event、update_event で使う)。
 * 事実 (ID・日時・人数) はシステムが作った欄に、第三者の文字列 (イベント名・説明・ラベル・名前・コメント) は
 * untrusted の欄に分けて出す。
 * URL を知っている人は誰でも全員の回答を見られる (Web と同じ) ので、集計と参加者もそのまま出す。
 */
export function formatEventDetail(ctx: McpContext, event: EventDetail, { includeSlots = false } = {}): string {
  const range = event.allowedRanges[0];
  const tz = event.timezone;
  const shown = event.participants.slice(0, PARTICIPANT_PAGE_SIZE);
  const omitted = event.participants.length - shown.length;

  const facts = [
    "## イベント情報 (システム生成)",
    `event_id: ${event.id}`,
    `URL: ${eventUrl(ctx, event.id)}  (参加者に共有する URL。ほかのツールにはこの URL を渡す)`,
    `timezone: ${tz}`,
    `現在日時: ${formatNow(tz)}`,
    `日程の範囲: ${formatDate(event.startDate)} 〜 ${formatDate(event.endDate)}`,
    `入力できる時間帯: ${range ? `${range.startTime} 〜 ${range.endTime}` : "終日"} (15 分単位、${tz})`,
    `イベントの編集: ${editorsOf(ctx, event)}`,
    "参加形態 (回答で使う ID):",
    ...event.options.map((o) => `  - id=${o.id} (ラベルは下の untrusted ブロックを参照)`),
    "",
    `## 回答 (${event.participants.length} 人)`,
    ...(event.participants.length === 0
      ? ["まだ誰も回答していません。"]
      : shown.flatMap((p) => [
          `- participant_id=${p.id} (名前は下の untrusted ブロックを参照) / 時間帯 ${p.slots.length} 件${participantNote(p)}`,
          ...(includeSlots ? formatSlots(p.slots, tz).map((line) => `    - ${line}`) : []),
        ])),
    ...(omitted > 0 ? [`(残りの ${omitted} 人は省略)`] : []),
    ...(includeSlots || event.participants.length === 0
      ? []
      : ['(各回答の時間帯は、include="slots" を指定すると取得できる。回答を更新する前には必ず取得すること)']),
  ];

  if (event.participants.length > 0) {
    const candidates = findCandidates(availabilityOf(event), { limit: TOP_CANDIDATES });
    facts.push(
      "",
      `## 参加できる人数の集計 (上位 ${TOP_CANDIDATES} 件、30 分以上続く時間帯)`,
      ...headcountNotes(event),
      ...(candidates.length === 0
        ? ["30 分以上続く時間帯はありません。find_common_availability で条件を変えて探せます。"]
        : candidates.map((c, i) => formatCandidate(c, i + 1, event))),
    );
  }

  const untrusted = [
    `event_name: "${sanitize(event.name)}"`,
    `description: "${sanitize(event.description)}"`,
    ...event.options.map((o) => `option[${o.id}] label: "${sanitize(o.label)}"`),
    ...shown.map((p) => `participant[${p.id}] name: "${sanitize(p.name)}" / comment: "${sanitize(p.comment)}"`),
  ];

  return `${facts.join("\n")}\n\n${untrustedBlock(untrusted)}`;
}
