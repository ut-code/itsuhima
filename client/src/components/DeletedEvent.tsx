import { LuRotateCcw } from "react-icons/lu";
import { NavLink } from "react-router";
import dayjs from "../lib/dayjs";

type Props = {
  name: string;
  /** 完全に消える日時 (ISO 8601) */
  purgeAt: string;
  canRestore: boolean;
  restoring: boolean;
  onRestore: () => void;
};

/** 削除されたイベントのページ。完全に消えるまでは、戻せる人が戻せる */
export function DeletedEvent({ name, purgeAt, canRestore, restoring, onRestore }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-4 px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex min-h-100 w-full flex-col items-center justify-center gap-4 rounded-xl border border-base-300 bg-base-100 p-8 text-center shadow-sm">
        <p className="text-base-content/70 text-xl">「{name}」は削除されました。</p>
        <p className="text-base-content/70 text-sm">
          {dayjs(purgeAt).tz().format("YYYY年M月D日 H:mm")} ごろに完全に消えます。
          {canRestore ? "それまでは元に戻せます。" : "それまでは、イベントを作った人が元に戻せます。"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {canRestore && (
            <button type="button" className="btn btn-primary gap-1.5" disabled={restoring} onClick={onRestore}>
              <LuRotateCcw className="h-4 w-4" />
              元に戻す
            </button>
          )}
          <NavLink to="/home" className="btn btn-outline">
            ホームに戻る
          </NavLink>
        </div>
      </div>
    </div>
  );
}
