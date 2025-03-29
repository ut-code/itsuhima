import { NavLink } from "react-router";
import { InvolvedProjects, involvedProjectsResSchema } from "../../../common/schema";
import { useData } from "../hooks";
import Header from "../components/Header";
import { API_ENDPOINT } from "../utils";
import { IoMdTrash } from "react-icons/io";

async function deleteEvent(id: string) {
  if (confirm("本当にこのイベントを削除しますか？")) {
    try {
      const response = await fetch(`${API_ENDPOINT}/projects/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("削除に失敗しました。");
      }
      alert("イベントを削除しました。");
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました。もう一度お試しください。");
    }
  }
}

export default function RootPage() {
  const {
    data: involvedProjects,
    loading,
    refetch,
  } = useData<InvolvedProjects>(`${API_ENDPOINT}/users`, involvedProjectsResSchema);

  return (
    <>
      <Header />
      <div className="container p-4 mx-auto flex flex-col gap-4 justify-center items-center">
        <div className="flex flex-col items-center">
          <p className="text-lg text-gray-600">「いつ暇？」で日程調整しよう</p>
        </div>
        <div className="flex justify-center">
          <NavLink to="./new" end className="btn btn-lg btn-primary">
            イベントを作成
          </NavLink>
        </div>
        {loading ? (
          <div className="py-4">
            <span className="loading loading-dots loading-md text-gray-400"></span>
          </div>
        ) : involvedProjects ? (
          <div className="mt-4 w-full px-4">
            <h2 className="text-2xl text-gray-600 mb-2">作成したイベント</h2>
            {involvedProjects.asHost.length > 0 ? (
              <ul className="w-full">
                {involvedProjects.asHost.map((p) => (
                  <li key={p.id}>
                    <NavLink
                      to={`/${p.id}/submit`}
                      className="btn btn-ghost w-full h-full flex justify-between p-4"
                    >
                      <div className="flex flex-col items-start gap-1">
                        <h3 className="font-normal text-xl text-gray-600">{p.name}</h3>
                        <div className="font-normal text-sm text-gray-400">
                          {formatDate(p.startDate.toLocaleDateString())} ～{" "}
                          {formatDate(p.endDate.toLocaleDateString())}
                        </div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          await deleteEvent(p.id);
                          refetch();
                        }}
                      >
                        <IoMdTrash
                          id={`idIoMdTrash-${p.id}`}
                          className="text-gray-400 hover:text-gray-500 cursor-pointer ml-4"
                          size={24}
                        />
                      </button>
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
      {/* TODO: 使い方のイントロダクションなど */}
      <div className="mt-4">ランディングページ</div>
    </div>
  );
}

// ---------- Utility ----------
const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleDateString("ja-JP");
};
