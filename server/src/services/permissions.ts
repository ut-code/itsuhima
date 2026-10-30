/**
 * 操作する人。userId はログインしたユーザーの id で、ログインしていなければ null。
 * 今はログインが無いので、いつも null (匿名)。
 */
export type Actor = { userId: string | null };

/** ログインしていない人 */
export const anonymousActor: Actor = { userId: null };

/**
 * イベントの設定を変えたり、イベントを削除・戻したりできるか。
 * 匿名で作ったイベントは、URL を知っている全員が編集できる。今はすべてのイベントが匿名のもの。
 */
export function canEditEvent(_actor: Actor, _event: { id: string }) {
  return true;
}

/**
 * 回答を変えたり、消したりできるか。
 * 匿名の回答は、URL を知っている全員が編集できる (イベントの持ち主に関係なく)。今はすべての回答が匿名のもの。
 */
export function canEditParticipant(_actor: Actor, _event: { id: string }, _participant: { id: string }) {
  return true;
}
