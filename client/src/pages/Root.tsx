import { NavLink } from "react-router";
import { InvolvedProjects, involvedProjectsResSchema } from "../../../common/schema";
import { useData } from "../hooks";
import Header from "../components/Header";
import { API_ENDPOINT } from "../utils";

export default function RootPage() {
  console.log("🤩",API_ENDPOINT)
  const {
    data: involvedProjects,
    loading,
    error,
  } = useData<InvolvedProjects>(`${API_ENDPOINT}/users`, involvedProjectsResSchema);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p>エラーが発生しました: {error}</p>;

  return (
    <>
      <Header />
      <div className="container p-4 mx-auto flex flex-col gap-4 justify-center items-center">
        <div className="flex flex-col items-center">
          <img src="/logo.png" alt="logo" width="200px" />
          {/* TODO: 文面 */}
          <p>イツヒマは、日程調整アプリです。</p>
        </div>
        <div className="flex justify-center">
          <NavLink to="./new" end className="btn btn-lg btn-primary">
            イベントを作成
          </NavLink>
        </div>
        {involvedProjects ? <Preview asHost={involvedProjects.asHost} asGuest={involvedProjects.asGuest} /> : <Landing />}
      </div>
    </>
  )
}

function Preview({ asHost: hostingProjects, asGuest: guestingProjects }: InvolvedProjects) {
  return (
    <div className="mt-4">
      <h2 className="text-2xl font-bold">あなたがホストのイベント一覧</h2>
      {hostingProjects.length > 0 ? (
        <ul className="list-disc pl-5 space-y-2">
          {hostingProjects.map((p) => (
            <li key={p.id} className="border p-2 rounded">
              <NavLink to={`/${p.id}/submit`} className="block hover:underline">
                <div>イベント名: {p.name}</div>
                <div>
                  日付: {formatDate(p.startDate.toLocaleDateString())} ～{" "}
                  {formatDate(p.endDate.toLocaleDateString())}
                </div>
                <div>イベントID: {p.id}</div>
              </NavLink>
            </li>
          ))}
        </ul>
      ) : (
        <p>ホストしているイベントはありません。</p>
      )}

      <h2 className="text-2xl font-bold">あなたがゲストのイベント一覧</h2>
      {guestingProjects.length > 0 ? (
        <ul className="list-disc pl-5 space-y-2">
          {guestingProjects.map((p) => (
            <li key={p.id} className="border p-2 rounded">
              <NavLink to={`/${p.id}/submit`} className="block hover:underline">
                <div>イベント名: {p.name}</div>
                <div>
                  日付: {formatDate(p.startDate.toLocaleDateString())} ～{" "}
                  {formatDate(p.endDate.toLocaleDateString())}
                </div>
                <div>イベントID: {p.id}</div>
              </NavLink>
            </li>
          ))}
        </ul>
      ) : (
        <p>参加しているイベントはありません。</p>
      )}
    </div>
  );
}

function Landing() {
  return (
    <div className="p-4">
      <div className="mt-4">ランディングページ</div>
    </div>
  );
}

// ---------- Utility ----------
const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleDateString("ja-JP");
};
