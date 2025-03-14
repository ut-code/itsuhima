import { useState } from "react";
import { useNavigate } from "react-router";

export default function Create() {
  const [name, setName] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(""); // ISO 文字列
  const [endDate, setEndDate] = useState<string>(""); // ISO 文字列
  const [ranges, setRanges] = useState<{ startTime: string; endTime: string }[]>([]); // range 配列
  const navigate = useNavigate(); // ページ遷移
  const [loading, setLoading] = useState<boolean>(false);

  // range 追加処理
  const handleAddRange = () => {
    setRanges([...ranges, { startTime: "", endTime: "" }]);
  };

  // range 更新処理
  const handleRangeChange = (index: number, field: "startTime" | "endTime", value: string) => {
    const newRanges = [...ranges];
    newRanges[index][field] = value;
    setRanges(newRanges);
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // 日付部分が空の場合は送信させない
    if (!startDate || !endDate || !ranges) {
      alert("開始日と終了日を入力してください");
      setLoading(false);
      return;
    }
    if (startDate >= endDate) {
      alert("時間の形式が間違っています。");
      setLoading(false);
      return;
    }

    // startDate, endDate は "2025-03-13T00:00:00.000Z" 形式に変換
    const startDateTime = new Date(startDate + "T00:00:00.000Z").toISOString();
    const endDateTime = new Date(endDate + "T00:00:00.000Z").toISOString(); // 終日のため最後の瞬間

    // range も "startDate" を基準にして日時結合
    const rangeWithDateTime = ranges.map((range) => {
      const start = new Date(`${startDate}T${range.startTime}`).toISOString();
      const end = new Date(`${startDate}T${range.endTime}`).toISOString(); // 同日の時間帯として送信
      return {
        startTime: start,
        endTime: end,
      };
    });

    // 最終送信データ
    const eventData = {
      name,
      startDate: startDateTime,
      endDate: endDateTime,
      range: rangeWithDateTime,
    };

    console.log("送信データ:", eventData); // デバッグ用確認

    const res = await fetch("http://localhost:3000/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
      credentials: "include",
    });
    const eventId = await res.json();
    console.log("受信データ", eventId);

    if (res.ok) {
      navigate(`/${eventId}`);
      setLoading(false);
    } else {
      alert("送信に失敗しました");
      setLoading(false);
    }
  };
  return (
    <>
      {loading && (
        <div className="fixed inset-0 bg-opacity-50 flex justify-center items-center z-50">
          <span className="loading loading-spinner loading-lg text-blue"></span>
        </div>
      )}
      <h1>イベント作成</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>イベント名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input input-bordered w-full"
            required
            placeholder="イベント名"
          />
        </div>

        <div>
          <label>開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input input-bordered w-full"
            required
          />
        </div>

        <div>
          <label>終了日</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input input-bordered w-full"
            required
          />
        </div>

        <div>
          <label>範囲 (range)</label>
          {ranges.map((range, index) => (
            <div key={index} className="space-y-2 p-2 border rounded mb-2">
              <div>
                <label>開始時刻</label>
                <input
                  type="time"
                  value={range.startTime}
                  onChange={(e) => handleRangeChange(index, "startTime", `${e.target.value}:00`)}
                  className="input input-bordered w-full"
                  required
                />
              </div>
              <div>
                <label>終了時刻</label>
                <input
                  type="time"
                  value={range.endTime}
                  onChange={(e) => handleRangeChange(index, "endTime", `${e.target.value}:00`)}
                  className="input input-bordered w-full"
                  required
                />
              </div>
            </div>
          ))}
          <button type="button" onClick={handleAddRange} className="btn btn-secondary">
            範囲を追加
          </button>
        </div>

        <button type="submit" className="btn btn-primary w-full">
          送信
        </button>
      </form>
    </>
  );
}
