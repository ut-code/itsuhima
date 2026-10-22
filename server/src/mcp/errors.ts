import { ServiceError, type ServiceErrorReason } from "../services/errors.js";
import { toolError } from "./format.js";

/**
 * サービス層のエラーを、LLM が次に何をすればよいか分かる文に差し替える。
 * (サービス層の文は Web UI 向けで、参加形態のラベルなど第三者の文字列を含むことがあるので、そのまま返さない)
 */
const messages = {
  event_not_found: () => "イベントが見つかりません。event_id を確かめるか、list_events で一覧を取得してください。",
  submission_not_found: () => "このイベントにはまだ回答していません。submit_availability で回答してください。",
  already_submitted: () =>
    "このイベントには回答済みです。変更するときは、get_event で今の回答と version を取得し、" +
    "update_availability の based_on_version にその version を渡してください。",
  version_conflict: () =>
    "別の端末から回答が更新されています。get_event で最新の回答と version を取得し直し、" +
    "どう変えるかをユーザーに確かめてから、もう一度 update_availability を呼んでください。",
  // 何件目のどの制約に反したかは、サービス層の文 (システムが作った文) に書かれている
  invalid_slot: (e) =>
    `${e.message} get_event で日程の範囲と入力できる時間帯を確かめ、時刻を 15 分単位 (:00 / :15 / :30 / :45) にそろえ、` +
    "日をまたぐ時間帯は日付ごとに分けて、指定し直してください。",
  not_host: () => "この操作は、イベントの主催者だけができます。",
  options_empty: () => "参加形態は 1 つ以上必要です。",
  option_in_use: () => "日程が登録されている参加形態は削除できません。",
} satisfies Record<ServiceErrorReason, (e: ServiceError) => string>;

/** ServiceError ならツールのエラーにする。それ以外 (想定外のエラー) は投げ直す */
export function serviceErrorResult(e: unknown) {
  if (e instanceof ServiceError) {
    return toolError(messages[e.reason](e));
  }
  throw e;
}
