import { useParams } from "react-router";

export default function Event() {
  const params = useParams();
  const id = params.eventId;
  return (
    <div>
      イベントだよ<p>{id}</p>
    </div>
  );
}
