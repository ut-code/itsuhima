import { NavLink, useParams } from "react-router";
import { Calendar } from "../../../components/Calendar";
import { Me, meResSchema, Project, projectResSchema } from "../../../../../common/schema";
import { useData } from "../../../hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../../../components/Header";
import { API_ENDPOINT } from "../../../utils";

export default function SubmissionPage() {
  const { eventId: projectId } = useParams<{ eventId: string }>();
  const { data: project, loading: projectLoading } = useData<Project>(
    projectId ? `${API_ENDPOINT}/projects/${projectId}` : null,
    projectResSchema,
  );

  const { data: me, loading: meLoading } = useData<Me>(`${API_ENDPOINT}/users/me`, meResSchema);

  const loading = projectLoading || meLoading;

  const guestAsMe = me?.guests.find((g) => g.projectId === projectId);
  const myGuestId = guestAsMe?.id;
  const isHost = me?.hosts.some((h) => h.projectId === projectId);

  const [guestName, setGuestName] = useState(guestAsMe?.name ?? "");

  const mySlotsRef = useRef<{ from: Date; to: Date }[]>([]);

  const postAvailability = useCallback(
    async (slots: { start: Date; end: Date }[], myGuestId: string) => {
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
        const response = await fetch(`${API_ENDPOINT}/projects/${projectId}/availabilities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (response.ok) {
          alert("提出しました。");
        } else {
          alert("提出に失敗しました。もう一度お試しください。");
        }
      } else {
        const response = await fetch(`${API_ENDPOINT}/projects/${projectId}/availabilities`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (response.ok) {
          alert("更新しました。");
        } else {
          alert("更新に失敗しました。もう一度お試しください。");
        }
      }
    },
    [guestName, projectId],
  );

  useEffect(() => {
    console.log("guestAsMe", guestAsMe);
    if (guestAsMe) {
      setGuestName(guestAsMe.name);
    }
  }, [guestAsMe]);

  return (
    <div className="h-[100dvh] flex flex-col">
      <Header />
      {loading ? (
        <div className="w-full flex-1 flex justify-center items-center">
          <span className="loading loading-dots loading-md text-gray-400"></span>
        </div>
      ) : !project ? (
        <div className="w-full flex-1">
          <p>イベントが存在しません。</p>
          <a href="/">ホームに戻る</a>
        </div>
      ) : (
        <div className="p-4 flex flex-col flex-1 h-full overflow-y-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl mb-2">{project.name} の日程調整</h1>
            {isHost && (
              <NavLink to={`/${projectId}/edit`} className="block hover:underline">
                編集する
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
              onClick={() => {
                postAvailability(
                  mySlotsRef.current.map((slot) => {
                    return { start: slot.from, end: slot.to };
                  }),
                  myGuestId ?? "",
                );
              }}
              className="btn btn-primary"
            >
              日程を{guestAsMe ? "更新" : "提出"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
