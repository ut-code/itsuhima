import { useState } from "react";
import { useNavigate } from "react-router";
import { EventSchema } from "../../../common/schema";

export default function Create() {
  const [name, setName] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(""); // ISO 文字列
  const [endDate, setEndDate] = useState<string>(""); // ISO 文字列
  const [ranges, setRanges] = useState<{ startTime: string; endTime: string }[]>([]); // range 配列
  const navigate = useNavigate(); // ページ遷移

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

    // EventSchema に合わせた形で送信
    const eventData = {
      name,
      startDate,
      endDate,
      range: ranges.map((range) => ({
        ...range,
      })),
    };

    console.log("送信データ:", eventData); // デバッグ用

    const res = await fetch("http://localhost:3000/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    });
    const data = await res.json();
    console.log("受信データ", data.event);

    const eventId = data.event.id; //TODO: バリデーション

    if (res.ok) {
      navigate(`./${eventId}/done`);
    } else {
      alert("送信に失敗しました");
    }
  };

  return (
    <>
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
