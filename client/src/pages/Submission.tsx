import { NavLink, useNavigate, useParams } from "react-router";
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
  const [isHost, setIsHost] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`http://localhost:3000/event/${eventId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("イベントが見つかりません");
        const data = await res.json();

        // event データのパース
        const parseEvent = EventSchema.parse(data.event);
        console.log("受信イベントデータ", parseEvent);
        console.log("受信ゲストデータ", data.guest);
        console.log("受信ゲストデータ", data.host);
        if (data.host) setIsHost(true);

        setEvent(parseEvent);

        if (data.guest) {
          const parseGuest = GuestSchema.parse(data.guest);
          const parseSlot = parseGuest.slots?.map((slot: Slot) => SlotSchema.parse(slot)) || [];
          console.log("受信ゲストデータ", parseGuest);
          // ゲスト名と選択されたスロットを初期値としてセット
          setGuestName(parseGuest.name);
          console.log(parseSlot, "🤩");
          setSelectedSlots(parseSlot);
        }
      } catch (err: any) {
        console.error(err);
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
    setLoading(true);
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
      eventId: eventId,
    };
    console.log("送信情報", guest);

    try {
      const parseData = GuestSchema.parse(guest);
      const res = await fetch(`http://localhost:3000/event/${eventId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseData),
        credentials: "include",
      });
      if (!res.ok) throw new Error("ゲスト登録に失敗しました");
      const result = await res.json();
      console.log("登録結果:", result.data);
      setSelectedSlots([]);
      setGuestName("");
      navigate(`./done`);
      setLoading(false);
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
      setLoading(false);
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
    <div className="p-4">
      <h1 className="text-xl font-bold">イベント詳細</h1>
      {isHost && (
        <NavLink to={`/${eventId}/edit`} className="block hover:underline">
          イベントを編集する
        </NavLink>
      )}
      <p>イベント名: {event.name}</p>
      <p>
        開催期間: {new Date(event.startDate).toLocaleDateString()} ～{" "}
        {new Date(event.endDate).toLocaleDateString()}
      </p>

      {/* ----------- 大枠 (Range) ----------- */}
      <h2 className="text-lg font-semibold mt-4">時間帯の大枠 (Range)</h2>
      <ul>
        {event.range.map((r) => (
          <li key={r.id} className="border p-2 my-2">
            {new Date(r.startTime).toLocaleString()} ～ {new Date(r.endTime).toLocaleString()}
          </li>
        ))}
      </ul>

      {/* ----------- ホスト (Host) ----------- */}
      <h2 className="text-lg font-semibold mt-4">ホスト</h2>
      {event.hosts?.length ? (
        <ul>
          {event.hosts.map((host) => (
            <li key={host.id} className="border p-2 my-2">
              {host.name} (ID: {host.id})
            </li>
          ))}
        </ul>
      ) : (
        <p>ホストはいません</p>
      )}

      {/* ----------- ゲスト (Guest) ----------- */}
      <h2 className="text-lg font-semibold mt-4">ゲスト</h2>
      {event.guests?.length ? (
        <ul>
          {event.guests.map((guest) => (
            <li key={guest.id} className="border p-2 my-2">
              {guest.name} (ID: {guest.id})
              {guest.slots && guest.slots.length > 0 && (
                <ul className="pl-4 mt-1">
                  {guest.slots!.map((slot: Slot) => (
                    <li key={slot.id}>
                      {new Date(slot.start).toLocaleString()} ～{" "}
                      {new Date(slot.end).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>ゲストはいません</p>
      )}

      {/* ----------- スロット (Slot) ----------- */}
      <h2 className="text-lg font-semibold mt-4">すべての登録済みスロット</h2>
      {event.slots?.length ? (
        <ul>
          {event.slots.map((slot) => (
            <li key={slot.id} className="border p-2 my-2">
              {new Date(slot.start).toLocaleString()} ～ {new Date(slot.end).toLocaleString()}{" "}
              {slot.guestId && <span>(ゲストID: {slot.guestId})</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p>登録済みスロットはありません</p>
      )}

      {/* ----------- ゲスト名入力 ----------- */}
      <h2 className="text-lg font-semibold mt-6">参加者情報</h2>
      <input
        type="text"
        placeholder="あなたの名前"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        className="input input-bordered w-full max-w-xs my-2"
      />

      {/* ----------- 希望時間帯の追加 ----------- */}
      <h2 className="text-lg font-semibold mt-6">希望時間帯を追加</h2>
      {dates.map((date) => (
        <div key={date} className="mt-4">
          <h3 className="font-semibold">{date}</h3>
          {event.range.map((r, index) => (
            <div key={r.id || `range-${index}`} className="border p-2 my-2 rounded">
              <p>
                大枠: {new Date(r.startTime).toLocaleTimeString()} ~{" "}
                {new Date(r.endTime).toLocaleTimeString()}
              </p>
              <div className="flex gap-2 my-2">
                <input
                  type="time"
                  placeholder="開始時間"
                  id={`start-${date}-${r.id}`}
                  className="input input-bordered"
                />
                <input
                  type="time"
                  placeholder="終了時間"
                  id={`end-${date}-${r.id}`}
                  className="input input-bordered"
                />
                <button
                  className="btn btn-outline"
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
            </div>
          ))}
        </div>
      ))}

      {/* ----------- 選択中の時間帯 ----------- */}
      <h2 className="text-lg font-semibold mt-6">選択中の時間帯</h2>
      <ul className="list-disc pl-6">
        {selectedSlots.map((slot, idx) => (
          <li key={idx}>
            {new Date(slot.start).toLocaleString()} ～ {new Date(slot.end).toLocaleString()}
          </li>
        ))}
      </ul>

      {/* ----------- 登録ボタン ----------- */}
      <div className="mt-6">
        <button onClick={handleRegisterGuest} className="btn btn-primary">
          登録
        </button>
      </div>
    </div>
  );
}
