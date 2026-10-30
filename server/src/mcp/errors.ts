import { ServiceError, type ServiceErrorReason } from "../services/errors.js";
import { toolError } from "./format.js";

/**
 * サービス層のエラーを、LLM が次に何をすればよいか分かる文に差し替える。
 * (サービス層の文は Web UI 向けで、参加形態のラベルなど第三者の文字列を含むことがあるので、そのまま返さない)
 */
const messages = {
  event_not_found: () =>
    "イベントが見つかりません。URL を確かめてください (URL は https://<ドメイン>/e/<21 文字の ID> の形)。",
  event_deleted: () =>
    "このイベントは削除されています。削除から 7 日以内なら、イベントの URL を Web で開くと戻せます。そのことをユーザーに伝えてください。",
  participant_not_found: () =>
    "回答が見つかりません。get_event で参加者の一覧と participant_id を取得し直してください (ほかの人が消した可能性があります)。",
  history_not_found: () => "変更の履歴が見つかりません。",
  forbidden: () => "この操作をする権限がありません。",
  options_empty: () => "参加形態は 1 つ以上必要です。",
  option_in_use: () => "日程が登録されている参加形態は削除できません。",
  // 何件目のどの制約に反したかは、サービス層の文 (システムが作った文) に書かれている
  invalid_slot: (e) =>
    `${e.message} get_event で日程の範囲と入力できる時間帯を確かめ、時刻を 15 分単位 (:00 / :15 / :30 / :45) にそろえ、` +
    "日をまたぐ時間帯は日付ごとに分けて、指定し直してください。",
} satisfies Record<ServiceErrorReason, (e: ServiceError) => string>;

/** ServiceError ならツールのエラーにする。それ以外 (想定外のエラー) は投げ直す */
export function serviceErrorResult(e: unknown) {
  if (e instanceof ServiceError) {
    return toolError(messages[e.reason](e));
  }
  throw e;
}
