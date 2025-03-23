import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ja";
import React, { useEffect, useRef } from "react";
import { Project } from "../../../common/schema";

dayjs.locale('ja');

type Props = {
  project: Project;
  myGuestId: string;
  mySlotsRef: React.RefObject<{ from: Date; to: Date }[]>;
};

const OTHERS_COLOR = "orange";
const MY_COLOR = "lightblue";
const CREATE_COLOR = "green";
const DELETE_COLOR = "red";

const MY_EVENT_ID = "myBox";
const OTHERS_EVENT_ID = "othersBox";
const SELECT_EVENT_ID = "selectBox";

export const Calendar = ({ project, myGuestId, mySlotsRef }: Props) => {
  const countDays =
    dayjs(project.endDate).startOf("day").diff(dayjs(project.startDate).startOf("day"), "day") + 1;
  // TODO: +1 は不要かも
  const myMatrixRef = useRef<CalendarMatrix>(new CalendarMatrix(countDays + 1, project.startDate));
  const othersMatrixRef = useRef<CalendarMatrix>(
    new CalendarMatrix(countDays + 1, project.startDate),
  );

  // TODO: 現在は最初の選択範囲のみ。FullCalendar の制約により、複数の allowedRanges には対応できないため、のちに selectAllow などで独自実装が必要
  const tmpAllowedRange = project.allowedRanges[0] ?? {
    startTime: dayjs(new Date()).set("hour", 0).set("minute", 0),
    endTime: dayjs(new Date()).set("hour", 23).set("minute", 59),
  };

  const othersSlotsRef = useRef<
    {
      from: Date;
      to: Date;
    }[]
  >([]);

  const calendarRef = useRef<FullCalendar | null>(null);

  const isSelectionDeleting = useRef<boolean | null>(null);

  // init
  const calendarApi = calendarRef.current?.getApi();
  const myMatrix = myMatrixRef.current;
  const othersMatrix = othersMatrixRef.current;

  if (calendarApi) {
    calendarApi.getEvents().forEach((event) => {
      event.remove();
    });

    const slots = project.guests.flatMap((guest) => guest.slots);
    slots.forEach((slot) => {
      const { from, to } = getVertexes(new Date(slot.from), new Date(slot.to));
      if (slot.guestId === myGuestId) {
        myMatrix.setRange(from, to, true);
      } else {
        othersMatrix.setRange(from, to, true);
      }
    });
    myMatrix.getSlots().forEach((slot) => {
      calendarApi.addEvent({
        start: slot.from,
        end: slot.to,
        display: "background",
        id: MY_EVENT_ID,
        color: MY_COLOR,
      });
      mySlotsRef.current.push({
        from: slot.from,
        to: slot.to,
      });
    });
    othersMatrix.getSlots().forEach((slot) => {
      calendarApi.addEvent({
        start: slot.from,
        end: slot.to,
        display: "background",
        id: OTHERS_EVENT_ID,
        color: OTHERS_COLOR,
      });
      othersSlotsRef.current.push({
        from: slot.from,
        to: slot.to,
      });
    });
  }

  useEffect(() => {
    // カレンダー外までドラッグした際に選択を解除
    const handleMouseUp = (e: MouseEvent | TouchEvent) => {
      const calendarEl = document.getElementById("ih-cal-wrapper");

      const target = (e instanceof MouseEvent) ? e.target : document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);

      const isExternal = calendarEl && !calendarEl.contains(target as Node);

      if (isSelectionDeleting.current !== null && calendarEl && isExternal) {
        isSelectionDeleting.current = null;
        const existingSelection = calendarRef.current?.getApi()?.getEventById(SELECT_EVENT_ID);
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
        headerToolbar={false}
        views={{
          timeGrid: {
            type: "timeGrid",
            duration: { days: countDays },
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
          // 選択範囲の表示
          // 通常の selection では矩形選択ができないため、イベントを作成することで選択範囲を表現している。
          // https://github.com/fullcalendar/fullcalendar/issues/4119
          (info) => {
            if (isSelectionDeleting.current === null) {
              // ドラッグ開始地点が既存の自分のイベントなら削除モード、そうでなければ追加モードとする。
              // isSelectionDeleting は select の発火時 (つまり、ドラッグが終了した際) に null にリセットされる。
              isSelectionDeleting.current = myMatrix.getIsSlotExist(info.start);
            }

            const selectionColor = isSelectionDeleting.current ? DELETE_COLOR : CREATE_COLOR;

            if (!calendarRef.current) return false;
            const calendarApi = calendarRef.current.getApi();

            // 既存の選択範囲をクリア
            const existingSelection = calendarApi.getEventById("selectBox");
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
              id: SELECT_EVENT_ID,
              startTime: startTime,
              endTime: endTime,
              startRecur: info.start,
              endRecur: info.end,
              display: "background",
              color: selectionColor,
            });
            return true;
          }
        }
        select={
          // 実際の編集
          (info) => {
            const { from, to } = getVertexes(info.start, info.end);
            if (isSelectionDeleting.current === null) return;
            editMySlots(from, to, isSelectionDeleting.current, calendarRef, mySlotsRef, myMatrixRef);
            isSelectionDeleting.current = null;
          }
        }
      />
    </div>
  );
};

class CalendarMatrix {
  private matrix: boolean[][];
  /**
   * 15 分を 1 セルとしたセルの数 (96 = 24 * 4)
   */
  private readonly quarterCount = 96;
  private initialDate: Dayjs;

  constructor(dayCount: number, initialDate: Date) {
    this.matrix = Array.from({ length: dayCount }, () =>
      Array.from({ length: this.quarterCount }, () => false),
    );
    this.initialDate = dayjs(initialDate).startOf("day");
  }

  private getIndex(date: Date) {
    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    const dayDiff = dayjs(date).startOf("day").diff(this.initialDate, "day");
    return [dayDiff, Math.floor(totalMinutes / 15)];
  }

  getIsSlotExist(date: Date): boolean {
    const [row, col] = this.getIndex(date);
    return this.matrix[row][col];
  }

  getSlots() {
    const slots: { from: Date; to: Date }[] = [];
    for (let day = 0; day < this.matrix.length; day++) {
      let isEvent = null;
      let start: Date | null = null;
      for (let q = 0; q < this.matrix[day].length; q++) {
        const currentCell = this.matrix[day][q];
        if (isEvent !== currentCell) {
          if (currentCell) {
            start = this.initialDate
              .add(day, "day")
              .add(q * 15, "minute")
              .toDate();
          } else {
            if (start) {
              const from = start;
              const to = this.initialDate
                .add(day, "day")
                .add(q * 15, "minute")
                .toDate();
              slots.push({ from, to });
            }
          }
          isEvent = currentCell;
        }
      }
    }
    return slots;
  }

  setSlot(from: Date, to: Date, newValue: boolean): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(dayjs(to).subtract(1, "minute").toDate());
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.matrix[r][c] = newValue;
      }
    }
  }

  setRange(from: Date, to: Date, newValue: boolean): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(dayjs(to).subtract(1, "minute").toDate());
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.matrix[r][c] = newValue;
      }
    }
  }
}

function editMySlots(
  from: Date,
  to: Date,
  isDeletion: boolean,
  calendarRef: React.RefObject<FullCalendar | null>,
  mySlotsRef: React.RefObject<{ from: Date; to: Date }[]>,
  myMatrix: React.RefObject<CalendarMatrix>,
) {
  if (!calendarRef.current) return;
  const calendarApi = calendarRef.current.getApi();

  calendarApi.getEvents().forEach((event) => {
    if (event.id !== MY_EVENT_ID) return;
    event.remove();
  });
  mySlotsRef.current = [];

  myMatrix.current.setRange(from, to, !isDeletion);
  myMatrix.current.getSlots().forEach((slot) => {
    calendarApi.addEvent({
      start: slot.from,
      end: slot.to,
      display: "background",
      color: MY_COLOR,
      id: MY_EVENT_ID,
    });
    mySlotsRef.current.push({
      from: slot.from,
      to: slot.to,
    });
  });

  // 選択範囲をクリア
  const existingSelection = calendarApi.getEventById(SELECT_EVENT_ID);
  if (existingSelection) {
    existingSelection.remove();
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
