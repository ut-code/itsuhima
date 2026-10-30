import { hc, type InferResponseType } from "hono/client";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { LuRotateCcw } from "react-icons/lu";
import type { AppType } from "../../../server/src/routes/api";
import type { EventSnapshot, ParticipantSnapshot } from "../../../server/src/services/snapshots";
import dayjs from "../lib/dayjs";
import { API_ENDPOINT, readErrorMessage } from "../utils";

const client = hc<AppType>(API_ENDPOINT);

type HistoryEntry = InferResponseType<(typeof client.events)[":eventId"]["history"]["$get"], 200>[number];

export type HistoryDialogHandle = { open: () => void };

type Props = {
  eventId: string;
  /** 今の参加形態の名前。消えた参加形態は、履歴の側の名前を使う */
  optionIdToLabel: Record<string, string>;
  /** 戻したあとに呼ぶ (イベントを読み直す) */
  onRestored: (message: string) => void;
  onError: (message: string) => void;
};

/** 変更の履歴。変える前の状態を一覧にし、戻せる人には「この状態に戻す」を出す */
export const HistoryDialog = forwardRef<HistoryDialogHandle, Props>(function HistoryDialog(
  { eventId, optionIdToLabel, onRestored, onError },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistory(null);
    try {
      const res = await client.events[":eventId"].history.$get({ param: { eventId } });
      if (res.status === 200) {
        setHistory(await res.json());
      } else {
        dialogRef.current?.close();
        onError(await readErrorMessage(res, "履歴を読み込めませんでした。"));
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      dialogRef.current?.close();
      onError("ネットワークエラーが発生しました。");
    }
  }, [eventId, onError]);

  useImperativeHandle(ref, () => ({
    open: () => {
      dialogRef.current?.showModal();
      fetchHistory();
    },
  }));

  const restore = async (entry: HistoryEntry) => {
    setRestoringId(entry.id);
    try {
      const res = await client.events[":eventId"].history[":historyId"].restore.$post({
        param: { eventId, historyId: entry.id },
      });
      if (res.ok) {
        dialogRef.current?.close();
        onRestored(entry.target === "event" ? "イベントの設定を戻しました。" : "回答を戻しました。");
      } else {
        onError(await readErrorMessage(res, "戻せませんでした。"));
      }
    } catch (error) {
      console.error("Error restoring history:", error);
      onError("ネットワークエラーが発生しました。");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box max-w-xl">
        <h3 className="mb-1 font-bold text-base-content text-lg">変更の履歴</h3>
        <p className="mb-4 text-base-content/70 text-sm">
          イベントの設定や回答を変える前の状態です。間違えて変えたときは、その状態に戻せます。
        </p>
        {history === null ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-dots loading-md text-base-content/40" />
          </div>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-base-content/70 text-sm">まだ変更はありません。</p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-base-200 overflow-y-auto">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base-content/60 text-xs">{dayjs(entry.createdAt).tz().format("M/D H:mm")}</p>
                  {entry.target === "event" ? (
                    <EventSnapshotSummary snapshot={entry.before as EventSnapshot} />
                  ) : (
                    <ParticipantSnapshotSummary
                      snapshot={entry.before as ParticipantSnapshot}
                      deleted={entry.action === "delete"}
                      optionIdToLabel={optionIdToLabel}
                    />
                  )}
                </div>
                {entry.canRestore && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline shrink-0 gap-1.5"
                    disabled={restoringId !== null}
                    onClick={() => restore(entry)}
                  >
                    <LuRotateCcw className="h-4 w-4" />
                    この状態に戻す
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="modal-action">
          <button type="button" className="btn btn-outline" onClick={() => dialogRef.current?.close()}>
            閉じる
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">閉じる</button>
      </form>
    </dialog>
  );
});

function EventSnapshotSummary({ snapshot }: { snapshot: EventSnapshot }) {
  const dates =
    snapshot.startDate === snapshot.endDate
      ? dayjs(snapshot.startDate).format("M/D")
      : `${dayjs(snapshot.startDate).format("M/D")}〜${dayjs(snapshot.endDate).format("M/D")}`;
  const ranges = snapshot.allowedRanges.map((r) => `${r.startTime}〜${r.endTime}`).join("、");
  return (
    <>
      <p className="font-medium text-base-content text-sm">イベントの設定の変更</p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-base-content/80 text-sm">
        <dt className="text-base-content/60">名前</dt>
        <dd className="wrap-break-word">{snapshot.name}</dd>
        <dt className="text-base-content/60">日程</dt>
        <dd>
          {dates}
          {ranges && ` ${ranges}`}
        </dd>
        <dt className="text-base-content/60">参加形態</dt>
        <dd className="wrap-break-word">{snapshot.options.map((o) => o.label).join("、")}</dd>
        {snapshot.description && (
          <>
            <dt className="text-base-content/60">説明</dt>
            <dd className="wrap-break-word line-clamp-2 whitespace-pre-wrap">{snapshot.description}</dd>
          </>
        )}
      </dl>
    </>
  );
}

/** 時間帯の終わりの時刻。日の終わり (翌日の 0:00) は 24:00 と出す */
function formatEndTime(endAt: string) {
  const end = dayjs(endAt).tz();
  return end.hour() === 0 && end.minute() === 0 ? "24:00" : end.format("H:mm");
}

/** 一覧に出す時間帯の数。超えた分は件数だけ出す */
const MAX_SLOTS_SHOWN = 3;

function ParticipantSnapshotSummary({
  snapshot,
  deleted,
  optionIdToLabel,
}: {
  snapshot: ParticipantSnapshot;
  /** 消した回答か */
  deleted: boolean;
  optionIdToLabel: Record<string, string>;
}) {
  const showOption = Object.keys(optionIdToLabel).length > 1;
  const slots = [...snapshot.slots].sort((a, b) => a.startAt.localeCompare(b.startAt));
  return (
    <>
      <p className="wrap-break-word font-medium text-base-content text-sm">
        「{snapshot.name}」の回答の{deleted ? "削除" : "変更"}
      </p>
      <ul className="mt-1 text-base-content/80 text-sm">
        {slots.length === 0 && <li>時間帯なし</li>}
        {slots.slice(0, MAX_SLOTS_SHOWN).map((slot) => (
          <li key={`${slot.startAt}-${slot.optionId}`}>
            {dayjs(slot.startAt).tz().format("M/D H:mm")}〜{formatEndTime(slot.endAt)}
            {showOption && ` (${optionIdToLabel[slot.optionId] ?? "削除された参加形態"})`}
          </li>
        ))}
        {slots.length > MAX_SLOTS_SHOWN && <li>ほか {slots.length - MAX_SLOTS_SHOWN} 件</li>}
      </ul>
      {snapshot.comment && (
        <p className="wrap-break-word mt-1 line-clamp-2 whitespace-pre-wrap text-base-content/70 text-sm">
          {snapshot.comment}
        </p>
      )}
    </>
  );
}
