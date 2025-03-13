import { useState } from "react";
import { useNavigate } from "react-router";

export default function Create() {
  const [eventId, setEventId] = useState("なし");
  const navigate = useNavigate(); // ページ遷移用

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (eventId === "なし") {
      alert("まずイベントを作成してください");
      return;
    }

    const res = await fetch("http://localhost:3000/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });

    if (res.ok) {
      navigate(`./${eventId}/done`); // イベントID付きで遷移
    } else {
      alert("送信に失敗しました");
    }
  };

  return (
    <>
      <h1>イベント作成</h1>
      <button onClick={() => setEventId(crypto.randomUUID())} className="btn">
        イベントを作成する
      </button>
      <p>{eventId}</p>
      <form onSubmit={handleSubmit}>
        <button type="submit" className="btn btn-primary">
          送信
        </button>
      </form>
    </>
  );
}
