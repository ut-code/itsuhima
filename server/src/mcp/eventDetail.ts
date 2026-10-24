import { findCandidates, summarizeAvailability } from "../../../common/availability.js";
import type { getEvent } from "../services/events.js";
import type { McpContext } from "./context.js";
import { formatDate, formatInterval, formatNow, sanitize, untrustedBlock } from "./format.js";

export type EventDetail = Awaited<ReturnType<typeof getEvent>>;

/** get_event で出す集計の件数 */
const TOP_CANDIDATES = 5;
/** 一度に出す参加者の上限 */
const GUEST_PAGE_SIZE = 50;

/** 主催者か、回答した参加者か。集計と他の参加者の名前は、メンバーにだけ見せる */
export function isMember(event: EventDetail): boolean {
  return event.isHost || event.meAsGuest !== null;
}

/** 回答した参加者を、集計の入力の形にする */
export function availabilityOf(event: EventDetail) {
  return summarizeAvailability(
    event,
    event.guests.map((g) => ({ id: g.id, name: g.name, slots: g.slots })),
  );
}

/** 集計の人数の数え方の注記。回答が 1 人だけなら、それも書く */
export function headcountNotes(event: EventDetail): string[] {
  return [
    "人数は回答した人の中で数える。まだ回答していない人は数に入らない。",
    ...(event.guests.length === 1 ? ["まだ 1 人しか回答していないので、みんなの共通の時間帯とは言えない。"] : []),
  ];
}

/** 候補の時間帯の 1 行 ("1. 2026-11-02(月) 10:00〜12:00 — 2 人 / 回答した 3 人中 (option <id>: 2 人)") */
export function formatCandidate(
  candidate: { startAt: string; endAt: string; members: { optionId: string }[] },
  rank: number,
  event: EventDetail,
): string {
  return `${rank}. ${formatInterval(candidate, event.timezone)} — ${candidate.members.length} 人 / 回答した ${event.guests.length} 人中 (${formatByOption(candidate.members)})`;
}

/** 参加形態ごとの人数 ("option <id>: 2 人, option <id>: 1 人") */
export function formatByOption(members: { optionId: string }[]): string {
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.optionId, (counts.get(m.optionId) ?? 0) + 1);
  return [...counts].map(([optionId, count]) => `option ${optionId}: ${count} 人`).join(", ");
}

/**
 * イベントの詳細 (get_event、create_event、Resource で使う)。
 * 事実 (ID・日時・人数) はシステムが作った欄に、第三者の文字列 (イベント名・説明・ラベル・名前・コメント) は
 * untrusted の欄に分けて出す。
 * 非メンバー (イベント ID を知っているだけの人) には、回答に必要な情報だけを出し、集計と他の参加者の名前は出さない。
 */
export function formatEventDetail(ctx: McpContext, event: EventDetail, { includeGuests = false } = {}): string {
  const member = isMember(event);
  const range = event.allowedRanges[0];
  const me = event.meAsGuest;
  const tz = event.timezone;

  const facts = [
    "## イベント情報 (システム生成)",
    `event_id: ${event.id}`,
    `URL: ${ctx.origin}/e/${event.id}`,
    `timezone: ${tz}`,
    `現在日時: ${formatNow(tz)}`,
    `日程の範囲: ${formatDate(event.startDate)} 〜 ${formatDate(event.endDate)}`,
    `入力できる時間帯: ${range ? `${range.startTime} 〜 ${range.endTime}` : "終日"} (15 分単位、${tz})`,
    `あなたの立場: ${event.isHost ? "主催者" : me ? "参加者" : "未参加 (このイベントにはまだ回答していない)"}`,
    `回答した人数: ${event.guests.length}`,
    "参加形態 (回答で使う ID):",
    ...event.options.map((o) => `  - id=${o.id} (ラベルは下の untrusted ブロックを参照)`),
  ];

  if (me) {
    facts.push(
      "あなたの回答: あり",
      `  version: ${me.version}  ← update_availability の based_on_version に、この値をそのまま渡すこと`,
      `  登録した時間帯 (${me.slots.length} 件):`,
      ...[...me.slots]
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .map((s) => `    - ${formatInterval(s, tz)} [option ${s.optionId}]`),
    );
  } else {
    facts.push("あなたの回答: なし (submit_availability で回答できる)");
  }

  if (member) {
    const candidates = findCandidates(availabilityOf(event), { limit: TOP_CANDIDATES });
    facts.push(
      "",
      `## 参加できる人数の集計 (上位 ${TOP_CANDIDATES} 件、30 分以上続く時間帯)`,
      ...(event.guests.length === 0
        ? ["まだ誰も回答していません。"]
        : [
            ...headcountNotes(event),
            ...(candidates.length === 0
              ? ["30 分以上続く時間帯はありません。find_common_availability で条件を変えて探せます。"]
              : candidates.map((c, i) => formatCandidate(c, i + 1, event))),
          ]),
    );
  } else {
    facts.push("", "## 参加できる人数の集計", "他の参加者の回答は、自分が回答すると見られるようになります。");
  }

  const untrusted = [
    `event_name: "${sanitize(event.name)}"`,
    `description: "${sanitize(event.description)}"`,
    ...event.options.map((o) => `option[${o.id}] label: "${sanitize(o.label)}"`),
  ];
  if (includeGuests && member) {
    const shown = event.guests.slice(0, GUEST_PAGE_SIZE);
    untrusted.push(
      `guests (${shown.length}/${event.guests.length} 件):`,
      ...shown.map(
        (g) => `  - name: "${sanitize(g.name)}" / comment: "${sanitize(g.comment)}" / 時間帯 ${g.slots.length} 件`,
      ),
    );
    if (event.guests.length > shown.length) {
      untrusted.push(`  (残りの ${event.guests.length - shown.length} 件は省略)`);
    }
  } else if (includeGuests) {
    untrusted.push("(参加者の名前とコメントは、自分が回答すると見られるようになる)");
  } else if (member) {
    untrusted.push('(参加者の名前とコメントは、include="guests" を指定すると取得できる)');
  }

  return `${facts.join("\n")}\n\n${untrustedBlock(untrusted)}`;
}
