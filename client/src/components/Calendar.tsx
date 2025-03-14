import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs, { Dayjs } from "dayjs";
import React, { useRef } from "react";
import { Project } from "../../../common/schema";

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
    console.log(dayDiff, totalMinutes);
    return [dayDiff, Math.floor(totalMinutes / 15)];
  }

  getSlots() {
    const slots: { from: Date; to: Date }[] = [];
    for (let day = 0; day < this.matrix.length; day++) {
      let isEvent = this.matrix[day][0];
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

function editSlots(
  from: Date,
  to: Date,
  isDeletion: boolean,
  calendarRef: React.RefObject<FullCalendar | null>,
  slotsRef: React.RefObject<{ from: Date; to: Date }[]>,
  matrix: React.RefObject<CalendarMatrix>,
) {
  if (!calendarRef.current) return;
  const calendarApi = calendarRef.current.getApi();

  calendarApi.getEvents().forEach((event) => {
    event.remove();
  });
  slotsRef.current = [];

  matrix.current.setRange(from, to, !isDeletion);
  matrix.current.getSlots().forEach((slot) => {
    calendarApi.addEvent({
      start: slot.from,
      end: slot.to,
      display: "background",
      color: "orange",
    });
    slotsRef.current.push({
      from: slot.from,
      to: slot.to,
    });
  });

  // 選択範囲をクリア
  const existing = calendarApi.getEventById("selectBox");
  if (existing) {
    existing.remove();
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

type Props = {
  project: Project;
  onSubmit: (slots: { start: Date; end: Date }[]) => void;
};

export const Calendar = ({ project, onSubmit }: Props) => {
  const calendarCells = useRef<CalendarMatrix>(new CalendarMatrix(7, new Date("2025-03-09")));

  const calendarRef = useRef<FullCalendar | null>(null);

  const slotsRef = useRef<
    {
      from: Date;
      to: Date;
    }[]
  >([]);

  const hoveringEventRef = useRef<{ from: Date; to: Date } | null>(null);
  const deletionStartRef = useRef<{ from: Date; to: Date } | null>(null);

  const handleDragStart = () => {
    if (hoveringEventRef.current) {
      // console.log("✨", "deletionStartRef continued!", hoveringEventRef.current);
      deletionStartRef.current = { ...hoveringEventRef.current };
    }
  };

  // const handleDragEnd = () => {
  //   if (deletionStartRef.current && hoveringEventRef.current) {
  //     // console.log("🧨", "delete", deletionStartRef.current, hoveringEventRef.current);
  //   }
  // };
  document.onmousedown = handleDragStart;
  // document.onmouseup = handleDragEnd;

  // TODO: スマホで動かない・・・？
  // document.onpointerdown = handleDragStart;
  // document.onpointerup = handleDragEnd;

  // init
  const calendarApi = calendarRef.current?.getApi();
  const matrix = calendarCells.current;

  if (calendarApi) {
    calendarApi.getEvents().forEach((event) => {
      event.remove();
    });
    slotsRef.current = [];

    const slots = project.guests.flatMap((guest) => guest.slots);
    slots.forEach((slot) => {
      const { from, to } = getVertexes(new Date(slot.start), new Date(slot.end));
      matrix.setRange(from, to, true);
    });
    matrix.getSlots().forEach((slot) => {
      calendarApi.addEvent({
        start: slot.from,
        end: slot.to,
        display: "background",
        color: "orange",
      });
      slotsRef.current.push({
        from: slot.from,
        to: slot.to,
      });
    });
  }

  return (
    <>
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        longPressDelay={200}
        slotDuration={"00:15:00"}
        eventMouseEnter={(info) => {
          if (info.event.start && info.event.end) {
            hoveringEventRef.current = { from: info.event.start, to: info.event.end };
          }
        }}
        eventMouseLeave={() => {
          hoveringEventRef.current = null;
        }}
        // TODO: 単一セルだとダメかもしれない・・・ (select が赤にならない)
        selectable={true}
        selectAllow={
          // https://github.com/fullcalendar/fullcalendar/issues/4119
          (info) => {
            let selectionColor = "green";
            if (deletionStartRef.current) {
              console.log("🔥", deletionStartRef.current);
              selectionColor = "red";
            }
            if (!calendarRef.current) {
              console.log("no calendar ref");
              return false;
            }
            const calendarApi = calendarRef.current.getApi();
            const existing = calendarApi.getEventById("selectBox");
            if (existing) {
              existing.remove();
            }
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
              id: "selectBox",
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
        select={(info) => {
          const { from, to } = getVertexes(info.start, info.end);
          editSlots(from, to, !!deletionStartRef.current, calendarRef, slotsRef, calendarCells);
          deletionStartRef.current = null;
          hoveringEventRef.current = null;
        }}
      />
      <div>
        <button
          onClick={() => {
            onSubmit(
              slotsRef.current.map((slot) => {
                return { start: slot.from, end: slot.to };
              }),
            );
          }}
        >
          イベントを表示
        </button>
      </div>
    </>
  );
};
