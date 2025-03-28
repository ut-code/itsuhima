import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ja";
import React, { useEffect, useRef } from "react";
import { Project } from "../../../common/schema";
import { DateSelectArg, DateSpanApi } from "@fullcalendar/core/index.js";
import { Tooltip } from 'react-tooltip'

dayjs.locale('ja');

type Props = {
  project: Project;
  myGuestId: string;
  mySlotsRef: React.RefObject<{ from: Date; to: Date }[]>;
};

const OPACITY = 0.2
const PRIMARY_RGB = [15, 130, 177]

const MY_EVENT = "ih-my-event";
const OTHERS_EVENT = "ih-others-event";
const SELECT_EVENT = "ih-select-event"
const CREATE_SELECT_EVENT = "ih-create-select-event";
const DELETE_SELECT_EVENT = "ih-delete-select-event"

export const Calendar = ({ project, myGuestId, mySlotsRef }: Props) => {
  const countDays =
    dayjs(project.endDate).startOf("day").diff(dayjs(project.startDate).startOf("day"), "day") + 1;
  // TODO: +1 は不要かも
  const myMatrixRef = useRef<CalendarMatrix>(new CalendarMatrix(countDays + 1, project.startDate));
  const othersMatrixRef = useRef<CalendarMatrix>(
    new CalendarMatrix(countDays + 1, project.startDate, true),
  );

  const myMatrix = myMatrixRef.current;
  const othersMatrix = othersMatrixRef.current;

  // TODO: 現在は最初の選択範囲のみ。FullCalendar の制約により、複数の allowedRanges には対応できないため、のちに selectAllow などで独自実装が必要
  const tmpAllowedRange = project.allowedRanges[0] ?? {
    startTime: dayjs(new Date()).set("hour", 0).set("minute", 0),
    endTime: dayjs(new Date()).set("hour", 23).set("minute", 59),
  };

  const calendarRef = useRef<FullCalendar | null>(null);
  const isSelectionDeleting = useRef<boolean | null>(null);

  const calendarApi = calendarRef.current?.getApi();

  // init
  useEffect(() => {
    if (calendarApi) {
      calendarApi.getEvents().forEach((event) => {
        event.remove();
      });
      mySlotsRef.current = [];
      myMatrix.clear()
      othersMatrix.clear()

      const slots = project.guests.flatMap((guest) => guest.slots.map((slot) => ({
        ...slot,
        guestName: guest.name
      })));
      slots.forEach((slot) => {
        const { from, to } = getVertexes(new Date(slot.from), new Date(slot.to));
        if (slot.guestId === myGuestId) {
          myMatrix.setRange(from, to, 1);
        } else {
          othersMatrix.incrementRange(from, to, slot.guestName);
        }
      });
      myMatrix.getSlots().forEach((slot) => {
        calendarApi.addEvent({
          id: MY_EVENT,
          className: MY_EVENT,
          start: slot.from,
          end: slot.to,
          textColor: "black",
        });
        mySlotsRef.current.push({
          from: slot.from,
          to: slot.to,
        });
      });
      othersMatrix.getSlots().forEach((slot) => {
        calendarApi.addEvent({
          id: OTHERS_EVENT,
          className: OTHERS_EVENT,
          start: slot.from,
          end: slot.to,
          color: `rgba(${PRIMARY_RGB.join(",")}, ${(1 - Math.pow(1 - OPACITY, slot.weight)).toFixed(3)})`,
          display: "background",
          extendedProps: {
            members: slot.guestNames,
            countMembers: slot.weight
          }
        });
      });
    }

  }, [calendarApi, myGuestId, myMatrix, mySlotsRef, othersMatrix, project.guests]);


  useEffect(() => {
    // カレンダー外までドラッグした際に選択を解除
    const handleMouseUp = (e: MouseEvent | TouchEvent) => {
      const calendarEl = document.getElementById("ih-cal-wrapper");

      const target = (e instanceof MouseEvent) ? e.target : document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);

      const isExternal = calendarEl && !calendarEl.contains(target as Node);

      if (isSelectionDeleting.current !== null && calendarEl && isExternal) {
        isSelectionDeleting.current = null;
        const existingSelection = calendarRef.current?.getApi()?.getEventById(SELECT_EVENT);
        if (existingSelection) {
          existingSelection.remove();
        }
      }
    }
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [])

  return (
    <div className="h-full" id="ih-cal-wrapper">
      {/* <div>
      <button className="btn" onClick={() => {
          calendarApi?.prev()
        }}>{"<"}</button>
        <button className="btn" onClick={() => {
          calendarApi?.next()
        }}>{">"}</button>
      </div> */}
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        height={"auto"}
        longPressDelay={200}
        slotDuration={"00:15:00"}
        allDaySlot={false}
        initialDate={project.startDate}
        slotMinTime={dayjs(tmpAllowedRange.startTime).format("HH:mm:ss")}
        slotMaxTime={dayjs(tmpAllowedRange.endTime).format("HH:mm:ss")}
        views={{
          timeGrid: {
            type: "timeGrid",
            duration: { days: Math.min(countDays, 7) },
            // TODO: not working..?
            // visibleRange: {
            //   start: project.startDate,
            //   end: project.endDate,
            // },
            dayHeaderContent: (args) => {
              return dayjs(args.date).format("M/D (ddd)");
            },
            slotLabelContent: (args) => {
              return dayjs(args.date).format("HH:mm");
            },
            slotLabelInterval: "00:30:00",
            validRange: {
              start: project.startDate,
              end: project.endDate,
            },
          },
        }}
        initialView="timeGrid"
        selectable={true}
        selectAllow={
          // 選択中に選択範囲を表示する
          (info) => {
            return handleSelect(info, isSelectionDeleting, calendarRef, myMatrixRef);
          }
        }
        select={
          // 選択が完了した際に編集する
          (info) => {
            handleEdit(info, isSelectionDeleting, calendarRef, myMatrixRef, mySlotsRef);
          }
        }
        eventDidMount={
          (info) => {
            if (info.event.id === MY_EVENT) {
              // 既存の event 上で選択できるようにするため。
              info.el.style.pointerEvents = 'none';
            }
          }
        }
        eventContent={(info) => {
          if (info.event.id === OTHERS_EVENT) {
            return (
              <div className="w-full h-full">
                <div className="badge badge-sm"
                  data-tooltip-id="member-info"
                  data-tooltip-content={info.event.extendedProps.members?.join(", ")}
                  data-tooltip-place="top"
                >{info.event.extendedProps.countMembers}</div>
              </div>
            )
          } else if (info.event.id === MY_EVENT) {
            return (
              <div>
                {info.timeText}
              </div>
            )
          }
        }}
      />
      <Tooltip id="member-info" />
    </div>
  );
};

function handleSelect(
  info: DateSpanApi,
  isSelectionDeleting: React.RefObject<boolean | null>,
  calendarRef: React.RefObject<FullCalendar | null>,
  myMatrixRef: React.RefObject<CalendarMatrix>,
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
    (info.start.getHours() === info.end.getHours() &&
      info.start.getMinutes() > info.end.getMinutes())
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

function handleEdit(
  info: DateSelectArg,
  isSelectionDeleting: React.RefObject<boolean | null>,
  calendarRef: React.RefObject<FullCalendar | null>,
  myMatrixRef: React.RefObject<CalendarMatrix>,
  mySlotsRef: React.RefObject<{ from: Date; to: Date }[]>,
) {
  const { from, to } = getVertexes(info.start, info.end);

  if (isSelectionDeleting.current === null) return;
  if (!calendarRef.current) return;
  const isDeletion = isSelectionDeleting.current;

  if (!calendarRef.current) return;
  const calendarApi = calendarRef.current.getApi();

  calendarApi.getEvents().forEach((event) => {
    if (event.id !== MY_EVENT) return;
    event.remove();
  });
  mySlotsRef.current = [];

  myMatrixRef.current.setRange(from, to, isDeletion ? 0 : 1);
  myMatrixRef.current.getSlots().forEach((slot) => {
    calendarApi.addEvent({
      start: slot.from,
      end: slot.to,
      id: MY_EVENT,
      className: MY_EVENT,
      textColor: "black",
    });
    mySlotsRef.current.push({
      from: slot.from,
      to: slot.to,
    });
  });

  // 選択範囲をクリア
  const existingSelection = calendarApi.getEventById(SELECT_EVENT);
  if (existingSelection) {
    existingSelection.remove();
  }
  isSelectionDeleting.current = null;
}

class CalendarMatrix {
  private matrix: number[][];
  private guestNames: string[][][] | null;
  /**
   * 15 分を 1 セルとしたセルの数 (96 = 24 * 4)
   */
  private readonly quarterCount = 96;
  private initialDate: Dayjs;

  constructor(dayCount: number, initialDate: Date, hasGuestNames?: boolean) {
    this.matrix = Array.from({ length: dayCount }, () =>
      Array.from({ length: this.quarterCount }, () => 0),
    );
    this.guestNames = hasGuestNames ? Array.from({ length: dayCount }, () => Array.from({ length: this.quarterCount }, () => [])) : null
    this.initialDate = dayjs(initialDate).startOf("day");
  }

  private getIndex(date: Date) {
    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    const dayDiff = dayjs(date).startOf("day").diff(this.initialDate, "day");
    return [dayDiff, Math.floor(totalMinutes / 15)];
  }

  getIsSlotExist(date: Date): boolean {
    const [row, col] = this.getIndex(date);
    return this.matrix[row][col] !== 0;
  }

  getSlots() {
    const slots: { from: Date; to: Date, weight: number, guestNames?: string[] }[] = [];
    for (let day = 0; day < this.matrix.length; day++) {
      let eventCount = null;
      let start: Date | null = null;
      let startGuestNames: string[] | null = null
      for (let q = 0; q < this.matrix[day].length; q++) {
        const currentCell = this.matrix[day][q];
        if (eventCount !== currentCell) {
          if (start) {
            const from = start;
            const to = this.initialDate
              .add(day, "day")
              .add(q * 15, "minute")
              .toDate();
            const weight = eventCount ?? 0;
            slots.push({ from, to, weight, guestNames: startGuestNames ?? undefined });
            start = null;
          }
          if (currentCell !== 0) {
            start = this.initialDate
              .add(day, "day")
              .add(q * 15, "minute")
              .toDate();
            startGuestNames = this.guestNames?.[day][q] ?? null
          }
          eventCount = currentCell;
        }
      }
    }
    return slots;
  }

  setSlot(from: Date, to: Date, newValue: number): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(dayjs(to).subtract(1, "minute").toDate());
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.matrix[r][c] = newValue;
      }
    }
  }

  setRange(from: Date, to: Date, newValue: number): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(dayjs(to).subtract(1, "minute").toDate());
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.matrix[r][c] = newValue;
      }
    }
  }

  incrementRange(from: Date, to: Date, guestName: string): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(dayjs(to).subtract(1, "minute").toDate());
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.matrix[r][c] += 1;
        if (this.guestNames) {
          this.guestNames[r][c].push(guestName)
        }
      }
    }
  }

  clear() {
    this.matrix = Array.from({ length: this.matrix.length }, () =>
      Array.from({ length: this.quarterCount }, () => 0),
    );
  }
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
