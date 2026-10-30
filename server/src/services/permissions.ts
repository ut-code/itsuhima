/**
 * 操作する人。userId はログインしたユーザーの id で、ログインしていなければ null。
 */
export type Actor = { userId: string | null };

/** ログインしていない人 */
export const anonymousActor: Actor = { userId: null };

/** ログインした人の id。持ち主のない (匿名の) ものは null */
type Owned = { ownerUserId: string | null };

/**
 * イベントの設定を変えたり、イベントを削除・戻したりできるか。
 * 匿名で作ったイベントは、URL を知っている全員ができる。ログインして作ったイベントは、持ち主だけができる。
 */
export function canEditEvent(actor: Actor, event: Owned) {
  return event.ownerUserId === null || event.ownerUserId === actor.userId;
}

/** 回答の持ち主。ownerDeleted は、回答した人がアカウントを削除したか */
type ParticipantOwner = { userId: string | null; ownerDeleted: boolean };

/**
 * 回答を変えられるか。
 * 匿名の回答は、URL を知っている全員が変えられる (イベントの持ち主に関係なく)。ログインして出した回答は、その人だけ。
 * 回答した人がアカウントを削除した回答は、誰も変えられない。
 */
export function canEditParticipant(actor: Actor, _event: Owned, participant: ParticipantOwner) {
  if (participant.ownerDeleted) return false;
  return participant.userId === null || participant.userId === actor.userId;
}

/**
 * 回答を消せるか。変えられる人に加えて、ログインして作ったイベントの持ち主は、ほかの人の回答も消せる。
 * アカウントを削除した人の回答は、イベントを編集できる人が消せる (誰も消せないものを残さないため)。
 */
export function canDeleteParticipant(actor: Actor, event: Owned, participant: ParticipantOwner) {
  return (
    canEditParticipant(actor, event, participant) ||
    (event.ownerUserId !== null && event.ownerUserId === actor.userId) ||
    (participant.ownerDeleted && canEditEvent(actor, event))
  );
}

/** 自分 (ログインした人) の回答か */
export function isOwnParticipant(actor: Actor, participant: Pick<ParticipantOwner, "userId">) {
  return actor.userId !== null && participant.userId === actor.userId;
}
