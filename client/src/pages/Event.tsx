import { useParams, useNavigate } from "react-router";
import { useState } from "react";

export default function Event() {
  const params = useParams();
  const navigate = useNavigate();
  const eventId = params.eventId;

  // 開始日と終了日の状態
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // 送信処理
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 日付のチェック（開始日が終了日よりも後になっていないか確認）
    if (startDate > endDate) {
      alert("開始日は終了日よりも前にしてください。");
      return;
    }

    const res = await fetch(`http://localhost:3000/events/${eventId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate }), // 両方送信
    });

    if (res.ok) {
      navigate(`./done`);
    } else {
      alert("送信に失敗しました");
    }
  };

  return (
    <div className="space-y-4">
      <p>イベントID: {eventId}</p>
      <p>参加可能な日付範囲を選んでください。</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="border p-2 rounded w-full"
          />
        </div>
        <div>
          <label className="block mb-1">終了日</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="border p-2 rounded w-full"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          登録
        </button>
      </form>
    </div>
  );
}
