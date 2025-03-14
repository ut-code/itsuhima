import { NavLink } from "react-router";
import { InvolvedProjects, involvedProjectsResSchema } from "../../../common/schema";
import { useData } from "../hooks";

export default function RootPage() {
  const {
    data: involvedProjects,
    loading,
    error,
  } = useData<InvolvedProjects>("http://localhost:3000/user", involvedProjectsResSchema);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p>エラーが発生しました: {error}</p>;

  return involvedProjects ? (
    <Preview asHost={involvedProjects.asHost} asGuest={involvedProjects.asGuest} />
  ) : (
    <Landing />
  );
}

function Preview({ asHost: hostingProjects, asGuest: guestingProjects }: InvolvedProjects) {
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-4xl mb-4">トップページ</h1>
      <NavLink to="./new" end className="btn btn-primary">
        イベントを作成する。
      </NavLink>
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

// ---------- Landing ----------
function Landing() {
  return (
    <div className="p-4">
      <h1 className="text-4xl mb-4">トップページ</h1>
      <NavLink to="./new" end className="btn btn-primary">
        イベントを作成する。
      </NavLink>
      <div className="mt-4">ランディングページ</div>
    </div>
  );
}

// ---------- Utility ----------
const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleDateString("ja-JP");
};
