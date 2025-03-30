import { NavLink, useParams } from "react-router";
import { Calendar } from "../../components/Calendar";
import { ProjectRes, projectResSchema } from "../../../../common/schema";
import { useData } from "../../hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../../components/Header";
import { API_ENDPOINT } from "../../utils";
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlinePencil } from "react-icons/hi";

export default function SubmissionPage() {
  const { eventId: projectId } = useParams<{ eventId: string }>();
  const {
    data: project,
    loading: projectLoading,
    refetch: projectRefetch,
  } = useData<ProjectRes>(
    projectId ? `${API_ENDPOINT}/projects/${projectId}` : null,
    projectResSchema,
  );

  const [postLoading, setPostLoading] = useState(false);

  const loading = projectLoading || postLoading;

  const meAsGuest = project?.meAsGuest;
  const myGuestId = meAsGuest?.id;
  const isHost = project?.isHost;

  const [guestName, setGuestName] = useState(meAsGuest?.name ?? "");

  const mySlotsRef = useRef<{ from: Date; to: Date }[]>([]);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const postSubmissions = useCallback(
    async (slots: { start: Date; end: Date }[], myGuestId: string) => {
      setPostLoading(true);
      const payload = {
        name: guestName,
        projectId,
        slots,
      };
      try {
        // submitReqSchema.parse(payload) TODO:
      } catch (err) {
        console.error(err);
        return;
      }
      if (!myGuestId) {
        const response = await fetch(`${API_ENDPOINT}/projects/${projectId}/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (response.ok) {
          setToast({
            message: "提出しました。",
            variant: "success",
          });
          setTimeout(() => setToast(null), 3000);
        } else {
          setToast({
            message: "提出に失敗しました。もう一度お試しください。",
            variant: "error",
          });
          setTimeout(() => setToast(null), 3000);
        }
      } else {
        const response = await fetch(`${API_ENDPOINT}/projects/${projectId}/submissions/mine`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (response.ok) {
          setToast({
            message: "更新しました。",
            variant: "success",
          });
          setTimeout(() => setToast(null), 3000);
        } else {
          setToast({
            message: "更新に失敗しました。もう一度お試しください。",
            variant: "error",
          });
          setTimeout(() => setToast(null), 3000);
        }
      }
      await Promise.all([projectRefetch()]);
      setPostLoading(false);
    },
    [guestName, projectId, projectRefetch],
  );

  useEffect(() => {
    if (meAsGuest) {
      setGuestName(meAsGuest.name);
    }
  }, [meAsGuest]);

  return (
    <>
      <div className="h-[100dvh] flex flex-col">
        <Header />
        {loading ? (
          <div className="w-full flex-1 flex justify-center items-center">
            <span className="loading loading-dots loading-md text-gray-400"></span>
          </div>
        ) : !project ? (
          <div className="flex flex-col justify-center items-center py-4 gap-4">
            <p className="text-xl text-gray-600">イベントが見つかりませんでした。</p>
            <NavLink to={"/"} className="link">
              ホームに戻る
            </NavLink>
          </div>
        ) : (
          <div className="p-4 flex flex-col flex-1 h-full overflow-y-auto">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl mb-2">{project.name} の日程調整</h1>
              {isHost && (
                <NavLink to={`/${projectId}/edit`} className="btn btn-sm font-normal text-gray-600">
                  <HiOutlinePencil />
                  編集
                </NavLink>
              )}
            </div>
            <Calendar project={project} myGuestId={myGuestId ?? ""} mySlotsRef={mySlotsRef} />
            <div className="p-2 flex justify-between items-center gap-2">
              <input
                type="text"
                placeholder="あなたの名前"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="input text-base"
              />
              <button
                className="btn btn-primary"
                disabled={loading || !guestName}
                onClick={() => {
                  if (!guestName) return;
                  postSubmissions(
                    mySlotsRef.current.map((slot) => {
                      return { start: slot.from, end: slot.to };
                    }),
                    myGuestId ?? "",
                  );
                }}
              >
                日程を{meAsGuest ? "更新" : "提出"}
              </button>
            </div>
          </div>
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
