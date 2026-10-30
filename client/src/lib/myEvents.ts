// 自分が作ったイベントと回答したイベントを、localStorage に控える。
// 今はサーバーが browserId で一覧を返すが、browserId をやめたあとはこの控えで一覧を出す。
// 名前や日付は控えず、表示するときにサーバーから取る (控えた後の変更が古いまま残らないように)。
// 権限には使わない。消えても、イベントの URL があれば開ける。

import { z } from "zod";

const STORAGE_KEY = "itsuhima:myEvents";

const myEventSchema = z.object({
  id: z.string(),
  /** 作ったイベントなら true、回答しただけなら false。browserId をやめると、サーバーからはわからなくなる */
  isHost: z.boolean(),
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

function saveMyEvents(events: MyEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    // 容量の超過やプライベートモードなど。控えられなくても困らない
    console.error("Failed to save my events:", error);
  }
}

/**
 * 控えに足す。同じ id のものは新しい内容で置き換える。
 * 渡さなかったものは消さない (Cookie が変わってサーバーの一覧から消えたものも、控えには残す)。
 */
export function rememberMyEvents(events: MyEvent[]) {
  const incoming = new Map(events.map((e) => [e.id, pickMyEvent(e)]));
  const kept = loadMyEvents().filter((e) => !incoming.has(e.id));
  saveMyEvents([...kept, ...incoming.values()]);
}

export function forgetMyEvent(eventId: string) {
  const events = loadMyEvents();
  const rest = events.filter((e) => e.id !== eventId);
  if (rest.length !== events.length) saveMyEvents(rest);
}

/** API のレスポンスの余分なフィールドを落とす */
function pickMyEvent({ id, isHost }: MyEvent): MyEvent {
  return { id, isHost };
}
