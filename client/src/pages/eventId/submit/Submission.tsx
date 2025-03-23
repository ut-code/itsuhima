import { NavLink, useNavigate, useParams } from "react-router";
import { Calendar } from "../../../components/Calendar";
import { Me, meResSchema, Project, projectResSchema } from "../../../../../common/schema";
import { useData } from "../../../hooks";
import { useCallback, useRef, useState } from "react";
import dayjs from "dayjs";
import Header from "../../../components/Header";
import { API_ENDPOINT } from "../../../utils";

export default function SubmissionPage() {
  const { eventId: projectId } = useParams<{ eventId: string }>();
  const {
    data: project,
    loading: projectLoading,
    error: projectError,
  } = useData<Project>(`${API_ENDPOINT}/projects/${projectId}`, projectResSchema);

  const {
    data: me,
    loading: meLoading,
  } = useData<Me>(`${API_ENDPOINT}/users/me`, meResSchema);

  const loading = projectLoading || meLoading;
  const error = projectError;

  const [guestName, setGuestName] = useState("");

  const myGuestId = me?.guests.find((g) => g.projectId === projectId)?.id;
  const isHost = me?.hosts.some((h) => h.projectId === projectId);

  const navigate = useNavigate();

  // calendar state (ref)
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
        await fetch(`${API_ENDPOINT}/projects/${projectId}/availabilities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        navigate(`/${projectId}/submit/done`);
      } else {
        await fetch(`${API_ENDPOINT}/projects/${projectId}/availabilities`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        navigate(`/${projectId}/submit/done`);
      }
    },
    [guestName, projectId, navigate],
  );

  // -------------------- UI --------------------
  if (loading) return <p>読み込み中...</p>;
  if (error) return <p>エラー: {error}</p>;
  if (!project) return <p>イベントが存在しません。</p>;

  return (
    <>
      <Header />
      <div className="container p-4 mx-auto">
        <h1 className="text-xl font-bold">イベント詳細</h1>
        <p>イベント名: {project.name}</p>
        <p>
          日程範囲: {dayjs(project.startDate).format("YYYY/MM/DD")} 〜{" "}
          {dayjs(project.endDate).format("YYYY/MM/DD")}
        </p>
        {/*  FIXME: guestName の更新ごとに Calendar が再描画され、コストが大きい*/}
        <Calendar project={project} myGuestId={myGuestId ?? ""} mySlotsRef={mySlotsRef}/>

        {/* ----------- 大枠 (Range) ----------- */}
        {/* TODO: カレンダーにグレー枠で表示など */}
        {/* <h2 className="text-lg font-semibold mt-4">時間帯の大枠 (Range)</h2>
      <ul>
        {project.range.map((r) => (
          <li key={r.id} className="border p-2 my-2">
            {new Date(r.startTime).toLocaleString()} ～ {new Date(r.endTime).toLocaleString()}
          </li>
        ))}
      </ul> */}

        {/* ----------- ゲスト (Guest) ----------- */}
        {/* TODO: カレンダーに人数を表示など */}
        {/* <h2 className="text-lg font-semibold mt-4">ゲスト</h2>
      {project.guests?.length ? (
        <ul>
          {project.guests.map((guest) => (
            <li key={guest.id} className="border p-2 my-2">
              {guest.name} (ID: {guest.id})
              {guest.slots && guest.slots.length > 0 && (
                <ul className="pl-4 mt-1">
                  {guest.slots!.map((slot: Slot) => (
                    <li key={slot.id}>
                      {new Date(slot.start).toLocaleString()} ～{" "}
                      {new Date(slot.end).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>ゲストはいません</p>
      )} */}

        {/* TODO:  should be required */}
        <h2 className="text-lg font-semibold mt-6">参加者情報</h2>
        <input
          type="text"
          placeholder="あなたの名前"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          className="input input-bordered w-full max-w-xs my-2"
        />
        <div>
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
            日程を提出
          </button>
          {isHost && (
            <NavLink to={`/${projectId}/edit`} className="block hover:underline">
              イベントを編集する
            </NavLink>
          )}
        </div>
      </div>
    </>
  );
}
