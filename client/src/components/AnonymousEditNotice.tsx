import { useState } from "react";
import { LuInfo, LuX } from "react-icons/lu";

const DISMISSED_KEY = "itsuhima:anonymousEditNoticeDismissed";

/** この日を過ぎたら出さない (イベントは数日〜2 週間で使われ終わるので、それより長く知らせる) */
const SHOW_UNTIL = "2027-01-31";

function isDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  } catch (_) {
    return false;
  }
}

/** 編集の仕組みが変わったこと (匿名のものは、URL を知っている人は誰でも編集できる) を、一定期間知らせる。匿名のイベントでだけ出す */
export function AnonymousEditNotice() {
  const [visible, setVisible] = useState(() => new Date().toISOString().slice(0, 10) <= SHOW_UNTIL && !isDismissed());
  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch (_) {
      // 閉じた状態を控えられなくても、この画面では閉じる
    }
    setVisible(false);
  };

  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-base-content/80 text-sm">
      <LuInfo className="mt-0.5 h-4 w-4 shrink-0 text-info" />
      <p className="min-w-0 flex-1">
        編集の仕組みが変わりました。ログインせずに作ったイベントと回答は、URL
        を知っている人は誰でも編集できます。間違えて変えたときは「履歴」から元に戻せます。ログインしてから作ったイベントと回答は、本人だけが編集できます。
      </p>
      <button type="button" className="btn btn-circle btn-ghost btn-xs shrink-0" aria-label="閉じる" onClick={dismiss}>
        <LuX className="h-4 w-4" />
      </button>
    </div>
  );
}
