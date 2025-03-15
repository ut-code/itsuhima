import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs, { Dayjs } from "dayjs";
import React, { useRef } from "react";
import { Project } from "../../../common/schema";

type Props = {
  project: Project;
  onSubmit: (slots: { start: Date; end: Date }[], myGuestId: string) => void;
  myGuestId: string;
};

const OTHERS_COLOR = "orange";
const MY_COLOR = "lightblue";
const CREATE_COLOR = "green";
const DELETE_COLOR = "red";

const MY_EVENT_ID = "myBox";
const OTHERS_EVENT_ID = "othersBox";
const SELECT_EVENT_ID = "selectBox";

export const Calendar = ({ project, onSubmit, myGuestId }: Props) => {
  console.log("📅");
  // TODO: 横幅の挙動がおかしいので修正 (1 日少ないような・・)
  const countDays = dayjs(project.endDate).startOf("day").diff(dayjs(project.startDate).startOf("day"), "day") + 1;
  // console.log("📅", countDays);
  const myMatrixRef = useRef<CalendarMatrix>(new CalendarMatrix(7, project.startDate));
  const othersMatrixRef = useRef<CalendarMatrix>(new CalendarMatrix(7, project.startDate));

  const mySlotsRef = useRef<
    {
      from: Date;
      to: Date;
    }[]
  >([]);
  const othersSlotsRef = useRef<
    {
      from: Date;
      to: Date;
    }[]
  >([]);

  const calendarRef = useRef<FullCalendar | null>(null);

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
        console.log("🔵", from, to);
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

  return (
    <>
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        longPressDelay={200}
        slotDuration={"00:15:00"}
        allDaySlot={false}
        initialDate={project.startDate}
        headerToolbar={false}
        views={{
          timeGrid: {
            type: 'timeGrid',
            duration: { days: countDays},
            // TODO: not working..?
            // visibleRange: { 
            //   start: project.startDate,
            //   end: project.endDate,
            // },
            validRange: {
              start: project.startDate,
              end: project.endDate,
            }
          }
        }}
        initialView="timeGrid"
        eventMouseEnter={(info) => {
          if (info.event.start && info.event.end) {
            hoveringEventRef.current = { from: info.event.start, to: info.event.end };
          }
        }}
        eventMouseLeave={() => {
          hoveringEventRef.current = null;
        }}
        selectable={true}
        selectAllow={
          // 選択中の表示
          // https://github.com/fullcalendar/fullcalendar/issues/4119
          (info) => {
            if (!calendarRef.current) return false;
            const calendarApi = calendarRef.current.getApi();

            // ドラッグ開始地点が既存のイベントなら削除、そうでなければ追加 TODO: 単一セルだとダメかもしれない・・・ (select が赤にならない)
            const selectionColor = deletionStartRef.current ? DELETE_COLOR : CREATE_COLOR;

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
            editMySlots(from, to, !!deletionStartRef.current, calendarRef, mySlotsRef, myMatrixRef);
            deletionStartRef.current = null;
            hoveringEventRef.current = null;
          }
        }
      />
      <div>
        <button
          onClick={() => {
            onSubmit(
              mySlotsRef.current.map((slot) => {
                return { start: slot.from, end: slot.to };
              }),
              myGuestId,
            );
          }}
        >
          イベントを提出
        </button>
      </div>
    </>
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
