import { useParams } from "react-router";
import Header from "../../components/Header";
import { FRONTEND_ORIGIN } from "../../utils";

export default function CreateDonePage() {
  const { eventId } = useParams<{ eventId: string }>();
  return (
    <>
      <Header />
      <div className="container p-4 mx-auto">
        <h1>イベント作成完了</h1>
        <p>以下のURLを共有してください：</p>
        <a href={`${FRONTEND_ORIGIN}/${eventId}/submit`}>
          {FRONTEND_ORIGIN}/{eventId}/submit
        </a>
      </div>
    </>
  );
}
