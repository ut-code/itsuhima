import { HiOutlineCog } from "react-icons/hi";
import { NavLink } from "react-router";
import { type InvolvedProjects, involvedProjectsResSchema } from "../../../common/schema";
import Header from "../components/Header";
import { useData } from "../hooks";
import { API_ENDPOINT } from "../utils";

export default function RootPage() {
  const { data: involvedProjects, loading } = useData<InvolvedProjects>(
    `${API_ENDPOINT}/projects/mine`,
    involvedProjectsResSchema,
  );

  return (
    <>
      <Header />
      <div className="container p-4 mx-auto flex flex-col gap-4 justify-center items-center">
        <div className="flex flex-col items-center p-2">
          <p className="text-2xl text-gray-600">「いつ暇？」で日程調整しよう</p>
        </div>
        <div className="flex justify-center">
          <NavLink to="./new" end className="btn btn-lg btn-primary">
            イベントを作成
          </NavLink>
        </div>
        {loading ? (
          <div className="py-4">
            <span className="loading loading-dots loading-md text-gray-400" />
          </div>
        ) : involvedProjects ? (
          <div className="mt-4 w-full px-4">
            <h2 className="text-sm text-gray-400 mb-2">作成・提出したイベント</h2>
            {involvedProjects.length > 0 ? (
              <ul className="w-full">
                {involvedProjects.map((p) => (
                  <li key={p.id}>
                    <NavLink to={`/${p.id}`} className="btn btn-ghost w-full h-full flex justify-between p-4">
                      <div className="flex flex-col items-start gap-1">
                        <h3 className="font-normal text-xl text-gray-600">{p.name}</h3>
                        <div className="font-normal text-sm text-gray-400">
                          {formatDate(p.startDate.toLocaleDateString())} ～ {formatDate(p.endDate.toLocaleDateString())}
                        </div>
                      </div>
                      {p.isHost && (
                        <div className="flex">
                          <NavLink className="btn btn-ghost p-1" to={`/${p.id}/edit`}>
                            <HiOutlineCog className="text-gray-400 cursor-pointer" size={24} />
                          </NavLink>
                        </div>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p>あなたが作成したイベントはありません。</p>
            )}
          </div>
        ) : (
          <Landing />
        )}
      </div>
    </>
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
