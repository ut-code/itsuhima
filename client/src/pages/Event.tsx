import { useParams } from "react-router";
import { useEffect, useState } from "react";
import { EventSchema } from "../../../common/schema";
import { z } from "zod";

type Event = z.infer<typeof EventSchema>;
export default function Event() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`http://localhost:3000/event/${eventId}`);
        if (!res.ok) {
          throw new Error("イベントが見つかりません");
        }
        const data = await res.json();
        const parseData = EventSchema.parse(data.event);
        setEvent(parseData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p>エラー: {error}</p>;
  if (!event) return <p>イベントが存在しません。</p>;

  return (
    <div>
      <h1>イベント詳細</h1>
      <p>イベント名: {event.name}</p>
      <p>開始日: {new Date(event.startDate).toLocaleDateString()}</p>
      <p>終了日: {new Date(event.endDate).toLocaleDateString()}</p>

      <h2>時間帯一覧</h2>
      <ul>
        {event.range.map((r) => (
          <li key={r.id}>
            {new Date(r.startTime).toLocaleTimeString()} ~{" "}
            {new Date(r.endTime).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
