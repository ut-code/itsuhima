import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useRef } from "react";

type Props = {
  onAddRange: (range: { startTime: string; endTime: string }) => void;
};

const SELECTED_RANGE_EVENT_ID = "selected-range";
const PREVIEW_RANGE_EVENT_ID = "preview-range";
const SELECTED_COLOR = "lightblue";
const PREVIEW_COLOR = "green";

export function TimeRange({ onAddRange }: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);

  // 実際に選択確定したとき
  const handleSelect = (info: { start: Date; end: Date }) => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;

    // 既存の確定イベントとプレビューを削除
    const selectedEvent = calendarApi.getEventById(SELECTED_RANGE_EVENT_ID);
    if (selectedEvent) selectedEvent.remove();

    const previewEvent = calendarApi.getEventById(PREVIEW_RANGE_EVENT_ID);
    if (previewEvent) previewEvent.remove();

    // 確定イベント（青）を追加
    calendarApi.addEvent({
      id: SELECTED_RANGE_EVENT_ID,
      start: info.start,
      end: info.end,
      display: "background",
      color: SELECTED_COLOR,
    });

    // 選択範囲を親に伝える
    const toHHMM = (date: Date) => date.toTimeString().slice(0, 5);
    onAddRange({
      startTime: toHHMM(info.start),
      endTime: toHHMM(info.end),
    });
  };

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[timeGridPlugin, interactionPlugin]}
      initialView="timeGridDay"
      selectable={true}
      select={handleSelect}
      slotDuration="00:15:00"
      allDaySlot={false}
      height="auto"
      headerToolbar={false}
      dayHeaders={false}
      selectAllow={(info) => {
        const calendarApi = calendarRef.current?.getApi();
        if (!calendarApi) return false;

        // プレビュー用のイベントを一度消す
        const existingPreview = calendarApi.getEventById(PREVIEW_RANGE_EVENT_ID);
        if (existingPreview) existingPreview.remove();

        // プレビューイベント（緑）を表示
        calendarApi.addEvent({
          id: PREVIEW_RANGE_EVENT_ID,
          start: info.start,
          end: info.end,
          display: "background",
          color: PREVIEW_COLOR,
        });

        return true;
      }}
      datesSet={() => {
        const calendarApi = calendarRef.current?.getApi();
        if (calendarApi) {
          calendarApi.gotoDate(new Date());
        }
      }}
    />
  );
}
