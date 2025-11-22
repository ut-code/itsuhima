import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import type {
  DateSelectArg,
  DateSpanApi,
  DayHeaderContentArg,
  EventContentArg,
  EventInput,
  EventMountArg,
  SlotLabelContentArg,
} from "@fullcalendar/core/index.js";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "react-tooltip";
import { EditingMatrix, ViewingMatrix } from "../lib/CalendarMatrix";
import type { EditingSlot } from "../pages/eventId/Submission";

dayjs.locale("ja");

type AllowedRange = {
  startTime: Date;
  endTime: Date;
};

type ViewingSlot = {
  from: Date;
  to: Date;
  guestId: string;
  optionId: string;
};

type ParticipationOption = {
  id: string;
  label: string;
  color: string;
};

type CalendarEventExtendedProps = {
  optionBreakdown?: {
    optionId: string;
    optionLabel: string;
    color: string;
    members: string[];
    count: number;
  }[];
  backgroundStyle?: string;
};

type CalendarEvent = Pick<EventInput, "id" | "className" | "start" | "end" | "textColor" | "color" | "display"> & {
  extendedProps?: CalendarEventExtendedProps;
};

type Props = {
  startDate: Date;
  endDate: Date;
  allowedRanges: AllowedRange[];
  editingSlots: EditingSlot[];
  viewingSlots: ViewingSlot[];
  guestIdToName: Record<string, string>;
  participationOptions: ParticipationOption[];
  currentParticipationOptionId: string;
  editMode: boolean;
  onChangeEditingSlots: (slots: EditingSlot[]) => void;
};

const OPACITY = 0.2;
const PRIMARY_RGB = [15, 130, 177];

const EDITING_EVENT = "ih-editing-event";
const VIEWING_EVENT = "ih-viewing-event";
const SELECT_EVENT = "ih-select-event";
const CREATE_SELECT_EVENT = "ih-create-select-event";
const DELETE_SELECT_EVENT = "ih-delete-select-event";

// TODO: colors.ts のものと共通化
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [Number.parseInt(result[1], 16), Number.parseInt(result[2], 16), Number.parseInt(result[3], 16)]
    : (PRIMARY_RGB as [number, number, number]);
}

export const Calendar = ({
  startDate,
  endDate,
  allowedRanges,
  editingSlots,
  viewingSlots,
  guestIdToName,
  participationOptions,
  currentParticipationOptionId,
  editMode,
  onChangeEditingSlots,
}: Props) => {
  const countDays = dayjs(endDate).startOf("day").diff(dayjs(startDate).startOf("day"), "day") + 1;
  // TODO: +1 は不要かも
  const editingMatrixRef = useRef<EditingMatrix>(new EditingMatrix(countDays + 1, startDate));
  const viewingMatrixRef = useRef<ViewingMatrix>(new ViewingMatrix(countDays + 1, startDate));

  // TODO: 現在は最初の選択範囲のみ。FullCalendar の制約により、複数の allowedRanges には対応できないため、のちに selectAllow などで独自実装が必要
  const tmpAllowedRange = allowedRanges[0] ?? {
    startTime: dayjs(new Date()).set("hour", 0).set("minute", 0).toDate(),
    endTime: dayjs(new Date()).set("hour", 23).set("minute", 59).toDate(),
  };

  const calendarRef = useRef<FullCalendar | null>(null);
  const isSelectionDeleting = useRef<boolean | null>(null);

  // FullCalendar の state
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // editingSlots/viewingSlots → matrix → events
  useEffect(() => {
    // editingSlots → editingMatrix
    editingMatrixRef.current.clear();
    editingSlots.forEach((slot) => {
      const { from, to } = getVertexes(slot.from, slot.to);
      editingMatrixRef.current.setRange(from, to, slot.participationOptionId);
    });

    viewingMatrixRef.current.clear();

    viewingSlots.forEach((slot) => {
      const { from, to } = getVertexes(slot.from, slot.to);
      viewingMatrixRef.current.setGuestRange(from, to, slot.guestId, slot.optionId);
    });

    // matrix → events
    const editingEvents = editingMatrixRef.current.getSlots().map((slot, index) => {
      const option = participationOptions.find((o) => o.id === slot.optionId);
      const baseColor = option ? option.color : `rgb(${PRIMARY_RGB.join(",")})`;
      const rgbColor = hexToRgb(baseColor);
      const backgroundColor = `rgba(${rgbColor.join(",")}, ${OPACITY})`;

      return {
        id: `${EDITING_EVENT}-${index}`,
        className: EDITING_EVENT,
        start: slot.from,
        end: slot.to,
        textColor: "white",
        backgroundColor,
        borderColor: baseColor,
      };
    });

    const viewingEvents: CalendarEvent[] = [];
    const slots = viewingMatrixRef.current.getSlots();

    slots.forEach((slot, index) => {
      // optionId ごとにグループ化
      const optionGroups = new Map<string, string[]>();

      for (const [guestId, optionId] of Object.entries(slot.guestIdToOptionId)) {
        if (!optionGroups.has(optionId)) {
          optionGroups.set(optionId, []);
        }
        optionGroups.get(optionId)?.push(guestId);
      }

      // 参加形態ごとの内訳を作成。順番を participationOptions に合わせる
      const optionBreakdown = participationOptions
        .filter((option) => optionGroups.has(option.id))
        .map((option) => {
          const guestIds = optionGroups.get(option.id) || [];
          const guestNames = guestIds.map((guestId) => guestIdToName[guestId] || guestId);
          const optionOpacity = 1 - (1 - OPACITY) ** guestIds.length;

          return {
            optionId: option.id,
            optionLabel: option.label,
            color: option.color,
            members: guestNames,
            count: guestIds.length,
            opacity: optionOpacity,
          };
        });

      // 複数の参加形態がある場合は複合、　そうでなければ単色
      let backgroundStyle: string;
      if (optionBreakdown.length === 1) {
        const rgbColor = hexToRgb(optionBreakdown[0].color);
        backgroundStyle = `rgba(${rgbColor.join(",")}, ${optionBreakdown[0].opacity.toFixed(3)})`;
      } else {
        // 複数色の入ったセルを CSS gradient で生成（各optionの濃さを個別に適用）
        const stripeWidth = 100 / optionBreakdown.length;
        const gradientStops = optionBreakdown
          .map((breakdown, i) => {
            const rgbColor = hexToRgb(breakdown.color);
            const start = i * stripeWidth;
            const end = (i + 1) * stripeWidth;
            return `rgba(${rgbColor.join(",")}, ${breakdown.opacity.toFixed(3)}) ${start}%, rgba(${rgbColor.join(",")}, ${breakdown.opacity.toFixed(3)}) ${end}%`;
          })
          .join(", ");
        backgroundStyle = `linear-gradient(90deg, ${gradientStops})`;
      }

      // デフォルトの色（最初の参加形態の色）
      const defaultColor =
        optionBreakdown.length > 0
          ? (() => {
              const rgbColor = hexToRgb(optionBreakdown[0].color);
              return `rgba(${rgbColor.join(",")}, ${optionBreakdown[0].opacity.toFixed(3)})`;
            })()
          : `rgba(${PRIMARY_RGB.join(",")}, ${(1 - (1 - OPACITY) ** 1).toFixed(3)})`;

      viewingEvents.push({
        id: `${VIEWING_EVENT}-${index}`,
        className: `${VIEWING_EVENT} ${VIEWING_EVENT}-${index}`,
        start: slot.from,
        end: slot.to,
        color: defaultColor,
        display: "background" as const,
        extendedProps: {
          optionBreakdown,
          backgroundStyle,
        },
      });
    });

    setEvents([...editingEvents, ...viewingEvents]);
  }, [editingSlots, viewingSlots, guestIdToName, participationOptions]);

  // viewing events の背景スタイルを動的に注入
  useEffect(() => {
    const styleId = "ih-viewing-events-styles";
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    // viewing events の背景スタイルを生成
    const cssRules = events
      .filter((event) => event.className?.includes(VIEWING_EVENT))
      .map((event) => {
        if (!event.id) return "";
        const backgroundStyle = event.extendedProps?.backgroundStyle;
        const eventIndex = event.id.replace(`${VIEWING_EVENT}-`, "");
        if (backgroundStyle) {
          return `.${VIEWING_EVENT}-${eventIndex} { background: ${backgroundStyle} !important; }`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    styleElement.textContent = cssRules;

    return () => {
      // クリーンアップは不要（次回の更新で上書きされるため）
    };
  }, [events]);

  // カレンダー外までドラッグした際に選択を解除するためのイベントハンドラを登録
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent | TouchEvent) => {
      const calendarEl = document.getElementById("ih-cal-wrapper");

      const target =
        e instanceof MouseEvent
          ? e.target
          : document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);

      const isExternal = calendarEl && !calendarEl.contains(target as Node);

      if (isSelectionDeleting.current !== null && calendarEl && isExternal) {
        isSelectionDeleting.current = null;
        const existingSelection = calendarRef.current?.getApi()?.getEventById(SELECT_EVENT);
        if (existingSelection) {
          existingSelection.remove();
        }
      }
    };
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  const pageCount = Math.ceil(countDays / 7);

  const headerToolbar = useMemo(
    () =>
      pageCount >= 2
        ? {
            left: "prev",
            right: "next",
          }
        : false,
    [pageCount],
  );

  const views = useMemo(
    () => ({
      timeGrid: {
        type: "timeGrid",
        duration: { days: Math.min(countDays, 7) },
        dayHeaderContent: (args: DayHeaderContentArg) => {
          return (
            <div className="font-normal text-gray-600">
              <div>{dayjs(args.date).format("M/D")}</div>
              <div>{dayjs(args.date).format("(ddd)")}</div>
            </div>
          );
        },
        slotLabelContent: (args: SlotLabelContentArg) => {
          return <div className="text-gray-600">{dayjs(args.date).format("HH:mm")}</div>;
        },
        slotLabelInterval: "00:30:00",
        validRange: {
          start: startDate,
          end: endDate,
        },
        expandRows: true,
      },
    }),
    [countDays, startDate, endDate],
  );

  const handleSelectAllow = useCallback(
    // 選択中に選択範囲を表示する
    (info: DateSpanApi) => {
      if (!editMode) return false;
      return displaySelection(
        info,
        isSelectionDeleting,
        calendarRef,
        editingMatrixRef,
        participationOptions,
        currentParticipationOptionId,
      );
    },
    [editMode, participationOptions, currentParticipationOptionId],
  );

  const handleSelect = useCallback(
    // 選択が完了した際に編集する
    (info: DateSelectArg) => {
      if (!editMode) return;

      const { from, to } = getVertexes(info.start, info.end);

      if (isSelectionDeleting.current === null) return;
      const isDeletion = isSelectionDeleting.current;

      // matrix を更新
      editingMatrixRef.current.setRange(from, to, isDeletion ? null : currentParticipationOptionId);

      // matrix → editingSlots
      const newSlots = editingMatrixRef.current.getSlots().map((slot) => ({
        from: slot.from,
        to: slot.to,
        participationOptionId: slot.optionId,
      }));
      onChangeEditingSlots(newSlots);

      // 選択範囲をクリア
      const calendarApi = calendarRef.current?.getApi();
      const existingSelection = calendarApi?.getEventById(SELECT_EVENT);
      if (existingSelection) {
        existingSelection.remove();
      }
      isSelectionDeleting.current = null;
    },
    [editMode, onChangeEditingSlots, currentParticipationOptionId],
  );

  const handleEventDidMount = useCallback((info: EventMountArg) => {
    if (info.event.classNames.includes(EDITING_EVENT)) {
      // 既存の event 上で選択できるようにするため。
      info.el.style.pointerEvents = "none";

      const borderColor = info.event.borderColor;
      if (borderColor) {
        info.el.style.borderColor = borderColor;
      }
    }
    if (info.event.classNames.includes(VIEWING_EVENT)) {
      const backgroundStyle = info.event.extendedProps.backgroundStyle;
      if (backgroundStyle) {
        info.el.style.background = backgroundStyle;
      }
    }
    if (info.event.classNames.includes(CREATE_SELECT_EVENT)) {
      const borderColor = info.event.borderColor;
      if (borderColor) {
        info.el.style.borderColor = borderColor;
      }
    }
  }, []);

  const handleEventContent = useCallback((info: EventContentArg) => {
    if (info.event.classNames.includes(VIEWING_EVENT)) {
      const optionBreakdown: {
        optionId: string;
        optionLabel: string;
        color: string;
        members: string[];
        count: number;
      }[] = info.event.extendedProps.optionBreakdown || [];

      return (
        <div className="relative h-full w-full">
          {optionBreakdown.map((breakdown, index) => {
            const tooltipContent = `
              <div>
                <div style="font-weight: bold; margin-bottom: 4px; color: ${breakdown.color}">${breakdown.optionLabel}</div>
                <ul style="margin: 0; padding-left: 1.2rem; list-style-type: disc;">
                  ${breakdown.members.map((name) => `<li>${name}</li>`).join("")}
                </ul>
              </div>
            `;
            const position = ((index + 0.5) / optionBreakdown.length) * 100;

            return (
              <div
                key={breakdown.optionId}
                className="absolute top-1/2"
                style={{
                  left: `${position}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className="badge sm:badge-sm h-4 min-h-0 border-0 bg-gray-200 px-1 py-0 font-bold text-[10px] sm:h-5 sm:px-2 sm:text-sm"
                  style={{ color: breakdown.color }}
                  data-tooltip-id="member-info"
                  data-tooltip-html={tooltipContent}
                  data-tooltip-place="top"
                >
                  {breakdown.count}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    if (info.event.classNames.includes(EDITING_EVENT)) {
      return (
        <div className="h-full w-full overflow-hidden text-gray-600">{`${dayjs(info.event.start).format("HH:mm")} - ${dayjs(info.event.end).format("HH:mm")}`}</div>
      );
    }
  }, []);

  return (
    <div className="my-2 flex-1" id="ih-cal-wrapper">
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        height={"100%"}
        longPressDelay={200}
        slotDuration={"00:15:00"}
        allDaySlot={false}
        initialDate={startDate}
        slotMinTime={dayjs(tmpAllowedRange.startTime).format("HH:mm:ss")}
        slotMaxTime={dayjs(tmpAllowedRange.endTime).format("HH:mm:ss")}
        headerToolbar={headerToolbar}
        views={views}
        initialView="timeGrid"
        events={events}
        selectable={true}
        selectAllow={handleSelectAllow}
        select={handleSelect}
        eventDidMount={handleEventDidMount}
        eventContent={handleEventContent}
      />
      <Tooltip
        id="member-info"
        style={{
          backgroundColor: "#fff",
          color: "#666",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
        }}
      />
    </div>
  );
};

function displaySelection(
  info: DateSpanApi,
  isSelectionDeleting: React.RefObject<boolean | null>,
  calendarRef: React.RefObject<FullCalendar | null>,
  myMatrixRef: React.RefObject<EditingMatrix>,
  participationOptions: ParticipationOption[],
  currentParticipationOptionId: string,
) {
  // 選択範囲の表示
  // 通常の selection では矩形選択ができないため、イベントを作成することで選択範囲を表現している。
  // https://github.com/fullcalendar/fullcalendar/issues/4119

  if (isSelectionDeleting.current === null) {
    // ドラッグ開始地点が既存の自分のイベントなら削除モード、そうでなければ追加モードとする。
    // isSelectionDeleting は select の発火時 (つまり、ドラッグが終了した際) に null にリセットされる。
    isSelectionDeleting.current = myMatrixRef.current.getIsSlotExist(info.start);
  }

  if (!calendarRef.current) return false;
  const calendarApi = calendarRef.current.getApi();

  // 既存の選択範囲をクリア
  const existingSelection = calendarApi.getEventById(SELECT_EVENT);
  if (existingSelection) {
    existingSelection.remove();
  }

  // start と end が逆転している場合は入れ替える (TODO: refactor)
  let startTime = info.start.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
  let endTime = info.end.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (
    info.start.getHours() > info.end.getHours() ||
    (info.start.getHours() === info.end.getHours() && info.start.getMinutes() > info.end.getMinutes())
  ) {
    [startTime, endTime] = [endTime, startTime];
  }

  // 現在選択されている参加形態の色を取得
  const currentOption = participationOptions.find((o) => o.id === currentParticipationOptionId);
  const baseColor = currentOption ? currentOption.color : `rgb(${PRIMARY_RGB.join(",")})`;

  // 削除モードの場合は赤色、追加モードの場合は参加形態の色
  const isDeletion = isSelectionDeleting.current;
  const rgbColor = isDeletion ? [255, 0, 0] : hexToRgb(baseColor);
  const backgroundColor = `rgba(${rgbColor.join(",")}, ${isDeletion ? 0.5 : OPACITY})`;
  const borderColor = isDeletion ? "red" : baseColor;

  calendarApi.addEvent({
    id: SELECT_EVENT,
    className: isSelectionDeleting.current ? DELETE_SELECT_EVENT : CREATE_SELECT_EVENT,
    startTime: startTime,
    endTime: endTime,
    startRecur: info.start,
    endRecur: info.end,
    display: "background",
    backgroundColor: backgroundColor,
    borderColor: borderColor,
  });
  return true;
}

/**
 * 矩形選択した際の左上と右下の頂点を返す。from < to が前提
 */
function getVertexes(from: Date, to: Date) {
  if (from > to) {
    throw new Error("from < to is required");
  }
  const needSwap = dayjs(from).format("HH:mm") > dayjs(to).format("HH:mm");
  if (!needSwap) {
    return { from, to };
  }

  const fromMinute = dayjs(from).hour() * 60 + dayjs(from).minute();
  const toMinute = dayjs(to).hour() * 60 + dayjs(to).minute();

  return {
    from: dayjs(from).startOf("day").add(toMinute, "minute").toDate(),
    to: dayjs(to).startOf("day").add(fromMinute, "minute").toDate(),
  };
}
