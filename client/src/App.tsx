import { UserSchema } from "../../common/schema";
import { z } from "zod";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";
import { useRef } from "react";

import { NavLink } from "react-router";

async function sampleFetch() {
  const response = await fetch("http://localhost:3000/users/");
  const result = await response.json();
  const data = z.array(UserSchema).parse(result);
  data.forEach((item) => console.log("name: ", item.name, "age: ", item.age));
}

async function sampleEventFetch() {
  const response = await fetch("http://localhost:3000/sample/events");
  const result = await response.json();
  console.log(result);
}

function editSlots(
  from: Date,
  to: Date,
  calendarRef: React.RefObject<FullCalendar | null>,
  slotsRef: React.RefObject<{ from: Date; to: Date }[]>,
  isDeletion: boolean
) {
  if (!calendarRef.current) {
    console.log("no calendar ref");
    return;
  }
  const calendarApi = calendarRef.current.getApi();

  const start = dayjs(from);
  const end = dayjs(to);

  const dateDiff = end.startOf("day").diff(start.startOf("day"), "day") + 1;
  const needReverse = start.format("HH:mm") > end.format("HH:mm");

  const startHour = !needReverse ? start.hour() : end.hour();
  const startMinute = !needReverse ? start.minute() : end.minute();
  const endHour = !needReverse ? end.hour() : start.hour();
  const endMinute = !needReverse ? end.minute() : start.minute();

  if (!isDeletion) {
    // 各日付ごとに分解して Slot に追加
    for (let i = 0; i < dateDiff; i++) {
      console.log(dateDiff);
      const base = start.add(i, "day");

      const slotStart = base.hour(startHour).minute(startMinute);
      const slotEnd = base.hour(endHour).minute(endMinute);

      console.log(slotStart.toDate(), slotEnd.toDate());

      // TODO: 重複した場合追加を行わない
      slotsRef.current.push({
        from: slotStart.toDate(),
        to: slotEnd.toDate(),
      });

      calendarApi.addEvent({
        start: slotStart.toDate(),
        end: slotEnd.toDate(),
        display: "background",
        color: "red",
      });
    }
  } else {
    // TODO: 削除処理
  }

  // 選択範囲をクリア
  const existing = calendarApi.getEventById("selectBox");
  if (existing) {
    existing.remove();
  }
}

function App() {
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
      console.log("✨", "deletionStartRef continued!", hoveringEventRef.current);
      deletionStartRef.current = { ...hoveringEventRef.current };
    }
  };

  const handleDragEnd = () => {
    if (deletionStartRef.current && hoveringEventRef.current) {
      console.log("🧨", "delete", deletionStartRef.current, hoveringEventRef.current);
    }
  };
  document.onmousedown = handleDragStart;
  document.onmouseup = handleDragEnd;

  // TODO: スマホで動かない・・・？
  // document.onpointerdown = handleDragStart;
  // document.onpointerup = handleDragEnd;

  return (
    <>
      <h1 className="text-4xl">トップページ</h1>
      <NavLink to="/create" end>
        イベントを作成する。
      </NavLink>
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
        // TODO: 単一セルだとダメかもしれない・・・
        selectable={true}
        selectAllow={
          // https://github.com/fullcalendar/fullcalendar/issues/4119
          (info) => {
            let selectionColor = "green";
            if (deletionStartRef.current) {
              console.log("🔥", deletionStartRef.current);
              selectionColor = "blue";
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
          editSlots(info.start, info.end, calendarRef, slotsRef, !!deletionStartRef.current);
          deletionStartRef.current = null;
          hoveringEventRef.current = null;
        }}
      />
      <div>
        <button
          onClick={() => {
            alert(
              slotsRef.current
                .map((slot) => {
                  return `${slot.from.toLocaleString()} - ${slot.to.toLocaleString()}`;
                })
                .join("\n"),
            );
          }}
        >
          イベントを表示
        </button>
        <button className="btn" onClick={sampleFetch}>
          fetch
        </button>
        <button className="btn" onClick={sampleEventFetch}>
          events
        </button>
      </div>
    </>
  );
}

export default App;
