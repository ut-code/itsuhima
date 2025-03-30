import { NavLink } from "react-router";
import { InvolvedProjects, involvedProjectsResSchema } from "../../../common/schema";
import { useData } from "../hooks";
import Header from "../components/Header";
import { API_ENDPOINT } from "../utils";
import {
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiPencil,
  HiTrash,
} from "react-icons/hi";
import { useState } from "react";

export default function RootPage() {
  const {
    data: involvedProjects,
    loading,
    refetch,
  } = useData<InvolvedProjects>(`${API_ENDPOINT}/projects/mine`, involvedProjectsResSchema);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  async function deleteEvent(id: string) {
    if (confirm("本当にこのイベントを削除しますか？")) {
      try {
        const response = await fetch(`${API_ENDPOINT}/projects/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("削除に失敗しました。");
        }
        setToast({
          message: "イベントを削除しました。",
          variant: "success",
        });
        setTimeout(() => {
          setToast(null);
        }, 3000);
      } catch (error) {
        console.error(error);
        setToast({
          message: "エラーが発生しました。もう一度お試しください。",
          variant: "error",
        });
        setTimeout(() => {
          setToast(null);
        }, 3000);
      }
    }
  }

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
            <span className="loading loading-dots loading-md text-gray-400"></span>
          </div>
        ) : involvedProjects ? (
          <div className="mt-4 w-full px-4">
            <h2 className="text-sm text-gray-400 mb-2">作成・提出したイベント</h2>
            {involvedProjects.length > 0 ? (
              <ul className="w-full">
                {involvedProjects.map((p) => (
                  <li key={p.id}>
                    <NavLink
                      to={`/${p.id}`}
                      className="btn btn-ghost w-full h-full flex justify-between p-4"
                    >
                      <div className="flex flex-col items-start gap-1">
                        <h3 className="font-normal text-xl text-gray-600">{p.name}</h3>
                        <div className="font-normal text-sm text-gray-400">
                          {formatDate(p.startDate.toLocaleDateString())} ～{" "}
                          {formatDate(p.endDate.toLocaleDateString())}
                        </div>
                      </div>
                      {p.isHost && (
                        <div className="flex">
                          <NavLink className="btn btn-ghost p-1" to={`/${p.id}/edit`}>
                            <HiPencil className="text-gray-400 cursor-pointer" size={24} />
                          </NavLink>
                          <button
                            className="btn btn-ghost p-1"
                            onClick={async (e) => {
                              e.preventDefault();
                              await deleteEvent(p.id);
                              refetch();
                            }}
                          >
                            <HiTrash className="text-gray-400 cursor-pointer" size={24} />
                          </button>
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
      {toast && (
        <div className="toast toast-top toast-end z-50 mt-18">
          {toast.variant === "success" ? (
            <div className="alert bg-gray-200 border-0">
              <HiOutlineCheckCircle size={20} className="text-green-500" />
              <span>{toast.message}</span>
            </div>
          ) : (
            <div className="alert bg-gray-200 border-0">
              <HiOutlineExclamationCircle size={20} className="text-red-500" />
              <span>{toast.message}</span>
            </div>
          )}
        </div>
      )}
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
