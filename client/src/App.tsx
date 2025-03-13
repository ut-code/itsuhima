import { UserSchema } from "../../common/schema";
import { z } from "zod";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
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

function App() {
  const calendarRef = useRef<FullCalendar | null>(null);

  const slotsRef = useRef<{
    from: Date;
    to: Date;
  }[]>([]);

  function addSlots(from: Date, to: Date) {
    if (!calendarRef.current) {
      console.log("no calendar ref");
      return;
    }
    const calendarApi = calendarRef.current.getApi();

    const startDate = from.getDate();
    const endDate = to.getDate();

    const dateDiff = endDate - startDate + 1;

    // 各日付ごとに分解して Slot に追加
    for (let i = 0; i < dateDiff; i++) {
      const base = new Date(
        from.getFullYear(),
        from.getMonth(),
        from.getDate() + i
      )

      const start = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        from.getHours(),
        from.getMinutes()
      )

      const end = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        to.getHours(),
        to.getMinutes()
      )

      slotsRef.current.push({
        from: start,
        to: end,
      });

      calendarApi.addEvent({
        start,
        end,
      });
    }

    // 選択範囲をクリア
    const existing = calendarApi.getEventById("selectBox");
    if (existing) {
      existing.remove();
    }
  }

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
        selectable={true}
        selectAllow={
          // https://github.com/fullcalendar/fullcalendar/issues/4119
          (info) => {
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
            });
            return true;
          }
        }
        select={(info) => {
          addSlots(info.start, info.end);
        }}
      />
      <div>
        <button onClick={
          () => {
            alert(
              slotsRef.current.map((slot) => {
                return `${slot.from.toLocaleString()} - ${slot.to.toLocaleString()}`;
              }).join("\n")
            )
          }
        }>
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
