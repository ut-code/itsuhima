import { useEffect, useState } from "react";
import { fetchEventsByIds } from "../lib/eventsByIds";

/**
 * このブラウザの控えにあるイベントを、名前と URL で出す。控えが消える前に、URL を控えられるように。
 * 名前を読めなければ、何も出さない (件数は呼び出し側が出す)。
 */
export function RememberedEventLinks({ eventIds }: { eventIds: string[] }) {
  /** 読めなければ null、読み込み中は undefined */
  const [events, setEvents] = useState<{ id: string; name: string; deleted: boolean }[] | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchEventsByIds(eventIds)
      .then((found) => {
        if (!cancelled) setEvents(found);
      })
      .catch(() => {
        if (!cancelled) setEvents(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eventIds]);

  if (events === undefined) return <div className="skeleton h-16 w-full" />;
  if (!events || events.length === 0) return null;
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-base-300">
      {events.map((event) => {
        const url = `${window.location.origin}/e/${event.id}`;
        return (
          <a
            key={event.id}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block border-base-300 border-b px-3 py-2 last:border-b-0 hover:bg-base-200"
          >
            <span className="flex items-center gap-2 font-medium text-sm">
              <span className="truncate">{event.name}</span>
              {event.deleted && <span className="badge badge-sm badge-ghost shrink-0">削除済み</span>}
            </span>
            <span className="block truncate text-base-content/50 text-xs">{url}</span>
          </a>
        );
      })}
    </div>
  );
}
