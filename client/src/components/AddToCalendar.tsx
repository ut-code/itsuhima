import { LuCalendarPlus, LuCircleHelp } from "react-icons/lu";
import { Tooltip } from "react-tooltip";
import { DEFAULT_PARTICIPATION_OPTION } from "../../../common/colors";
import { generateIcs } from "../lib/generateIcs";
import type { Slot } from "../types";

type Props = {
  projectName: string;
  projectId: string;
  projectDescription?: string | null;
  slots: Pick<Slot, "from" | "to" | "participationOptionId">[];
  participationOptionIdToLabel: Record<string, string>;
  // 参加形態がデフォルト値のみ（＝実質未設定）かどうかの判定に使う
  participationOptionCount: number;
};

/**
 * 自分の提出済み日程をカレンダーアプリに追加するボタン。
 * その場で ics を生成してダウンロードさせ、各カレンダーアプリのインポート機能で読み込んでもらう。
 */
export function AddToCalendar({
  projectName,
  projectId,
  projectDescription,
  slots,
  participationOptionIdToLabel,
  participationOptionCount,
}: Props) {
  const handleClick = () => {
    const eventUrl = `${window.location.origin}/e/${projectId}`;
    const icsContent = generateIcs(
      projectName,
      slots.map((slot) => {
        const label = participationOptionIdToLabel[slot.participationOptionId] ?? "";
        // 参加形態がデフォルト値のみで他に選択肢がない場合、タイトルには含めない
        const isDefaultOnly = participationOptionCount <= 1 && label === DEFAULT_PARTICIPATION_OPTION.label;
        return {
          from: slot.from,
          to: slot.to,
          label: isDefaultOnly ? "" : label,
        };
      }),
      eventUrl,
      projectDescription ?? undefined,
    );

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "itsuhima.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-2 flex items-center gap-1">
      <button type="button" onClick={handleClick} className="btn btn-sm btn-outline gap-1.5">
        <LuCalendarPlus className="h-4 w-4" />
        <span>カレンダー追加 (β)</span>
      </button>
      <button
        type="button"
        aria-label="カレンダー追加についての説明"
        data-tooltip-id="add-to-calendar-info"
        data-tooltip-content="自分の候補日程をカレンダーに追加します。ダウンロードされる .ics ファイルを開き、お使いのカレンダーにインポートしてください。（ベータ版）"
        data-tooltip-place="top"
        className="btn btn-circle btn-ghost btn-xs text-base-content/50"
      >
        <LuCircleHelp className="h-4 w-4" />
      </button>
      <Tooltip id="add-to-calendar-info" openOnClick className="z-50 max-w-70" style={{ textAlign: "left" }} />
    </div>
  );
}
