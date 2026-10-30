// 自分が作ったイベントと回答したイベントを、localStorage に控える。ホームの一覧はこの控えから出す。
// 名前や日付は控えず、表示するときにサーバーから取る (控えた後の変更が古いまま残らないように)。
// 権限には使わない (URL を知っている人は誰でも編集できる)。消えても、イベントの URL があれば開ける。

import { z } from "zod";

const STORAGE_KEY = "itsuhima:myEvents";

/** 前の一覧 (browserId でサーバーが持っていたもの) を、控えに移したか */
const LEGACY_EXCHANGED_KEY = "itsuhima:legacyExchanged";

const myEventSchema = z.object({
  id: z.string(),
  /** 作ったイベントなら true、回答しただけなら false。サーバーからはわからないので控える */
  isHost: z.boolean(),
  /** このブラウザから出した回答の id。回答していなければ無い */
  participantId: z.string().optional(),
});

export type MyEvent = z.infer<typeof myEventSchema>;

export function loadMyEvents(): MyEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    // 壊れた項目だけを捨てる
    return parsed.data.flatMap((item) => {
      const result = myEventSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch (_) {
    return [];
  }
}

export function findMyEvent(eventId: string): MyEvent | undefined {
  return loadMyEvents().find((e) => e.id === eventId);
}

function saveMyEvents(events: MyEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    // 容量の超過やプライベートモードなど。控えられなくても困らない
    console.error("Failed to save my events:", error);
  }
}

/**
 * 控えに足す。同じ id のものがあれば、内容をまとめる (一度でも作ったなら isHost は true のまま)。
 * participantId は、渡したときだけ置き換える。
 */
export function rememberMyEvents(events: { id: string; isHost: boolean; participantId?: string | null }[]) {
  const current = loadMyEvents();
  const byId = new Map(current.map((e) => [e.id, e]));
  for (const { id, isHost, participantId } of events) {
    const existing = byId.get(id);
    byId.set(id, {
      id,
      isHost: isHost || (existing?.isHost ?? false),
      participantId: participantId ?? existing?.participantId,
    });
  }
  saveMyEvents([...byId.values()]);
}

export function rememberMyEvent(event: { id: string; isHost: boolean; participantId?: string | null }) {
  rememberMyEvents([event]);
}

/** 自分の回答を消したとき。イベントは控えに残す */
export function forgetMyParticipant(eventId: string) {
  const events = loadMyEvents();
  saveMyEvents(events.map((e) => (e.id === eventId ? { id: e.id, isHost: e.isHost } : e)));
}

/** イベントが無いか、自分で削除したとき */
export function forgetMyEvents(eventIds: string[]) {
  if (eventIds.length === 0) return;
  const ids = new Set(eventIds);
  const events = loadMyEvents();
  const rest = events.filter((e) => !ids.has(e.id));
  if (rest.length !== events.length) saveMyEvents(rest);
}

export function isLegacyExchanged() {
  try {
    return localStorage.getItem(LEGACY_EXCHANGED_KEY) !== null;
  } catch (_) {
    // localStorage が使えないなら、交換しても控えられない
    return true;
  }
}

export function markLegacyExchanged() {
  try {
    localStorage.setItem(LEGACY_EXCHANGED_KEY, "1");
  } catch (error) {
    console.error("Failed to mark legacy exchanged:", error);
  }
}
