import { useParams } from "react-router";
import Header from "../../components/Header";

export default function CreateDonePage() {
  const { eventId } = useParams<{ eventId: string }>();
  return (
    <>
      <Header />
      <div className="container p-4 mx-auto">
        <h1>イベント作成完了</h1>
        <p>以下のURLを共有してください：</p>
        <a href={`http://localhost:5173/${eventId}/submit`}>
          http://localhost:5173/{eventId}/submit
        </a>
      </div>
    </>
  );
}
