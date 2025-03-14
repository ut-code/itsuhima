import { useParams } from "react-router";

export default function CreateDonePage() {
  const { eventId } = useParams<{ eventId: string }>();
  return (
    <div>
      <div>
        <h1>イベント作成完了</h1>
        <p>以下のURLを共有してください：</p>
        <a href={`http://localhost:5173/${eventId}/submit`}>http://localhost:5173/{eventId}/submit</a>
      </div>
    </div>
  );
}
