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
  guestName: string;
};

type Props = {
  startDate: Date;
  endDate: Date;
  allowedRanges: AllowedRange[];
  editingSlots: EditingSlot[];
  viewingSlots: ViewingSlot[];
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

export const Calendar = ({
  startDate,
  endDate,
  allowedRanges,
  editingSlots,
  viewingSlots,
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

  // matrix → FullCalendar 用イベント（宣言的に管理）
  const [events, setEvents] = useState<
    Array<{
      id: string;
      className: string;
      start: Date;
      end: Date;
      textColor?: string;
      color?: string;
      display?: "background";
      extendedProps?: { members?: string[]; countMembers?: number };
    }>
  >([]);

  // editingSlots/viewingSlots → matrix → events
  useEffect(() => {
    // editingSlots → editingMatrix
    editingMatrixRef.current.clear();
    editingSlots.forEach((slot) => {
      const { from, to } = getVertexes(slot.from, slot.to);
      editingMatrixRef.current.setRange(from, to, 1);
    });

    // viewingSlots → viewingMatrix
    viewingMatrixRef.current.clear();
    viewingSlots.forEach((slot) => {
      const { from, to } = getVertexes(slot.from, slot.to);
      viewingMatrixRef.current.incrementRange(from, to, slot.guestName);
    });

    // matrix → events
    const editingEvents = editingMatrixRef.current.getSlots().map((slot, index) => ({
      id: `${EDITING_EVENT}-${index}`,
      className: EDITING_EVENT,
      start: slot.from,
      end: slot.to,
      textColor: "black",
    }));

    const viewingEvents = viewingMatrixRef.current.getSlots().map((slot, index) => ({
      id: `${VIEWING_EVENT}-${index}`,
      className: VIEWING_EVENT,
      start: slot.from,
      end: slot.to,
      color: `rgba(${PRIMARY_RGB.join(",")}, ${(1 - (1 - OPACITY) ** slot.weight).toFixed(3)})`,
      display: "background" as const,
      extendedProps: {
        members: slot.guestNames,
        countMembers: slot.weight,
      },
    }));

    setEvents([...editingEvents, ...viewingEvents]);
  }, [editingSlots, viewingSlots]);

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
      return displaySelection(info, isSelectionDeleting, calendarRef, editingMatrixRef);
    },
    [editMode],
  );

  const handleSelect = useCallback(
    // 選択が完了した際に編集する
    (info: DateSelectArg) => {
      if (!editMode) return;

      const { from, to } = getVertexes(info.start, info.end);

      if (isSelectionDeleting.current === null) return;
      const isDeletion = isSelectionDeleting.current;

      // matrix を更新
      editingMatrixRef.current.setRange(from, to, isDeletion ? 0 : 1);

      // matrix → editingSlots
      const newSlots = editingMatrixRef.current.getSlots().map((slot) => ({
        from: slot.from,
        to: slot.to,
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
    [editMode, onChangeEditingSlots],
  );

  const handleEventDidMount = useCallback((info: EventMountArg) => {
    if (info.event.classNames.includes(EDITING_EVENT)) {
      // 既存の event 上で選択できるようにするため。
      info.el.style.pointerEvents = "none";
    }
  }, []);

  const handleEventContent = useCallback((info: EventContentArg) => {
    if (info.event.classNames.includes(VIEWING_EVENT)) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="badge badge-sm border-0 bg-gray-200 font-bold text-primary"
            data-tooltip-id="member-info"
            data-tooltip-content={info.event.extendedProps.members?.join(", ")}
            data-tooltip-place="top"
          >
            {info.event.extendedProps.countMembers}
          </div>
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
      <Tooltip id="member-info" />
    </div>
  );
};

function displaySelection(
  info: DateSpanApi,
  isSelectionDeleting: React.RefObject<boolean | null>,
  calendarRef: React.RefObject<FullCalendar | null>,
  myMatrixRef: React.RefObject<EditingMatrix>,
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

  calendarApi.addEvent({
    id: SELECT_EVENT,
    className: isSelectionDeleting.current ? DELETE_SELECT_EVENT : CREATE_SELECT_EVENT,
    startTime: startTime,
    endTime: endTime,
    startRecur: info.start,
    endRecur: info.end,
    display: "background",
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
