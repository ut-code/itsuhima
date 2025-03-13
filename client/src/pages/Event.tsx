import { useParams } from "react-router";
import { useEffect, useState } from "react";
import { EventSchema, GuestSchema, SlotSchema } from "../../../common/schema";
import { z } from "zod";

type Event = z.infer<typeof EventSchema>;
type Slot = z.infer<typeof SlotSchema>;

export default function Event() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const browserId = "1234"; //TODO: cookieでいい感じにする。

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`http://localhost:3000/event/${eventId}`);
        if (!res.ok) throw new Error("イベントが見つかりません");
        const data = await res.json();
        const parseData = EventSchema.parse(data.event);
        console.log("受信データ", parseData);
        setEvent(parseData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (eventId) fetchEvent();
  }, [eventId]);

  // -------------------- Slot 追加処理 --------------------
  const handleAddSlot = (
    date: string,
    range: { id: string; startTime: string; endTime: string },
    start: string,
    end: string,
  ) => {
    // ✅ date + 時刻から datetime 生成
    const selectedStart = new Date(`${date}T${start}:00`);
    const selectedEnd = new Date(`${date}T${end}:00`);

    // ✅ 大枠の範囲から時刻部分だけ抜き出す (dateと無関係な時刻)
    const rangeStartTime = new Date(range.startTime);
    const rangeEndTime = new Date(range.endTime);

    // ✅ date部分を揃えて比較 (重要!!)
    const rangeStart = new Date(`${date}T${rangeStartTime.toISOString().split("T")[1]}`);
    const rangeEnd = new Date(`${date}T${rangeEndTime.toISOString().split("T")[1]}`);

    // ✅ 範囲チェック
    if (selectedStart < rangeStart || selectedEnd > rangeEnd || selectedStart >= selectedEnd) {
      alert("指定した時間が範囲外、または開始が終了より後になっています");
      return;
    }

    // ✅ SlotSchema形式に準拠したSlot作成
    const newSlot = {
      start: selectedStart.toISOString(),
      end: selectedEnd.toISOString(),
      eventId: eventId!, // eventId確定しているなら
    };

    console.log("新規Slot:", newSlot); // 確認用

    setSelectedSlots((prev) => [...prev, newSlot]);
  };

  // -------------------- Guest 登録処理 --------------------
  const handleRegisterGuest = async () => {
    if (!guestName.trim()) {
      alert("名前を入力してください");
      return;
    }

    // Slotバリデーション
    for (const slot of selectedSlots) {
      try {
        SlotSchema.parse(slot);
      } catch (err: any) {
        alert(`Slotの形式が不正です: ${err.message}`);
        return;
      }
    }

    // Guestオブジェクト
    const guest = {
      name: guestName,
      slots: selectedSlots,
      browserId: browserId,
      eventId: eventId,
    };
    console.log("送信情報", guest);

    try {
      const parseData = GuestSchema.parse(guest);
      const res = await fetch(`http://localhost:3000/event/${eventId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseData),
      });
      if (!res.ok) throw new Error("ゲスト登録に失敗しました");
      const result = await res.json();
      console.log("登録結果:", result.data);
      alert("登録に成功しました！");
      setSelectedSlots([]);
      setGuestName("");
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    }
  };

  // -------------------- 日付一覧生成 --------------------
  const getDatesInRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    while (start <= end) {
      dates.push(new Date(start).toISOString().split("T")[0]);
      start.setDate(start.getDate() + 1);
    }
    return dates;
  };

  // -------------------- UI --------------------
  if (loading) return <p>読み込み中...</p>;
  if (error) return <p>エラー: {error}</p>;
  if (!event) return <p>イベントが存在しません。</p>;

  const dates = getDatesInRange(event.startDate, event.endDate);

  return (
    <div>
      <h1>イベント詳細</h1>
      <p>イベント名: {event.name}</p>
      <p>
        開催期間: {new Date(event.startDate).toLocaleDateString()} ～{" "}
        {new Date(event.endDate).toLocaleDateString()}
      </p>

      <h2>参加者情報</h2>
      <input
        type="text"
        placeholder="あなたの名前"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        className="input"
      />

      <h2>希望時間帯を追加</h2>
      {dates.map((date) => (
        <div key={date}>
          <h3>{date}</h3>
          {event.range.map((r, index) => (
            <div
              key={r.id}
              style={{ marginBottom: "20px", padding: "10px", border: "1px solid gray" }}
            >
              <p>
                大枠: {new Date(r.startTime).toLocaleTimeString()} ~{" "}
                {new Date(r.endTime).toLocaleTimeString()}
              </p>
              <input type="time" placeholder="開始時間" id={`start-${date}-${r.id}`} />
              <input type="time" placeholder="終了時間" id={`end-${date}-${r.id}`} />
              <button
                onClick={() =>
                  handleAddSlot(
                    date,
                    { id: r.id || `range-${index}`, startTime: r.startTime, endTime: r.endTime },
                    (document.getElementById(`start-${date}-${r.id}`) as HTMLInputElement).value,
                    (document.getElementById(`end-${date}-${r.id}`) as HTMLInputElement).value,
                  )
                }
              >
                追加
              </button>
            </div>
          ))}
        </div>
      ))}

      <h2>選択中の時間帯</h2>
      <ul>
        {selectedSlots.map((slot, idx) => (
          <li key={idx}>
            {new Date(slot.start).toLocaleString()} ~ {new Date(slot.end).toLocaleString()}
          </li>
        ))}
      </ul>

      <button onClick={handleRegisterGuest} className="btn btn-primary">
        登録
      </button>
    </div>
  );
}
