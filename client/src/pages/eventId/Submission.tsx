import { hc } from "hono/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineCheckCircle,
  HiOutlineCog,
  HiOutlineExclamationCircle,
  HiOutlineHome,
  HiPencil,
} from "react-icons/hi";
import { NavLink, useParams } from "react-router";
import type { AppType } from "../../../../server/src/main";
import { Calendar } from "../../components/Calendar";
import Header from "../../components/Header";
import { projectReviver } from "../../revivers";
import type { Project, Slot } from "../../types";
import { API_ENDPOINT } from "../../utils";

const client = hc<AppType>(API_ENDPOINT);

export type EditingSlot = Pick<Slot, "from" | "to">;

export default function SubmissionPage() {
  const { eventId: projectId } = useParams<{ eventId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  const [postLoading, setPostLoading] = useState(false);

  const loading = projectLoading || postLoading;

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setProjectLoading(false);
      return;
    }
    setProjectLoading(true);
    try {
      const res = await client.projects[":projectId"].$get(
        {
          param: { projectId },
        },
        {
          init: { credentials: "include" },
        },
      );
      if (res.status === 200) {
        const data = await res.json();
        const parsedData = projectReviver(data);
        setProject(parsedData);
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    } finally {
      setProjectLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const meAsGuest = project?.meAsGuest;
  const myGuestId = meAsGuest?.id;
  const isHost = project?.isHost;

  const [editMode, setEditMode] = useState(true);

  const [guestName, setGuestName] = useState(meAsGuest?.name ?? "");

  const [editingSlots, setEditingSlots] = useState<EditingSlot[]>([]);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const postSubmissions = useCallback(
    async (slots: { start: Date; end: Date }[], myGuestId: string) => {
      setPostLoading(true);
      const payload = {
        name: guestName,
        projectId: projectId || "",
        slots: slots.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
        })),
      };
      if (!myGuestId) {
        const response = await client.projects[":projectId"].submissions.$post(
          {
            param: { projectId: projectId || "" },
            json: payload,
          },
          {
            init: { credentials: "include" },
          },
        );
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
        const response = await client.projects[":projectId"].submissions.mine.$put(
          {
            param: { projectId: projectId || "" },
            json: payload,
          },
          {
            init: { credentials: "include" },
          },
        );
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
      await Promise.all([fetchProject()]);
      setPostLoading(false);
    },
    [guestName, projectId, fetchProject],
  );

  useEffect(() => {
    if (meAsGuest) {
      setGuestName(meAsGuest.name);
      setEditMode(false);
    }
  }, [meAsGuest]);

  // init editing slots
  useEffect(() => {
    if (project?.meAsGuest?.slots && editMode) {
      setEditingSlots(
        project.meAsGuest.slots.map((slot) => ({
          from: slot.from,
          to: slot.to,
        })),
      );
    }
  }, [project, editMode]);

  // init viewing slots
  const viewingSlots = useMemo(() => {
    if (!project) return [];

    if (editMode) {
      // 編集モードの場合、自分のスロットは editingSlots に入るので、こちらには自分以外のスロットのみ含める
      return project.guests
        .filter((g) => g.id !== myGuestId)
        .flatMap((g) =>
          g.slots.map((s) => ({
            from: s.from,
            to: s.to,
            guestName: g.name,
          })),
        );
    }

    // 閲覧モードの場合は自分も含めて全て
    return project.guests.flatMap((g) =>
      g.slots.map((s) => ({
        from: s.from,
        to: s.to,
        guestName: g.name,
      })),
    );
  }, [project, myGuestId, editMode]);

  return (
    <>
      <div className="flex h-[100dvh] flex-col">
        <Header />
        {loading ? (
          <div className="flex w-full flex-1 items-center justify-center">
            <span className="loading loading-dots loading-md text-gray-400" />
          </div>
        ) : !project ? (
          <div className="flex flex-col items-center justify-center gap-4 py-4">
            <p className="text-gray-600 text-xl">イベントが見つかりませんでした。</p>
            <NavLink to={"/"} className="link">
              ホームに戻る
            </NavLink>
          </div>
        ) : (
          <div className="flex h-full flex-1 flex-col overflow-y-auto p-4">
            <div className="flex items-center justify-between">
              <h1 className="mb-2 font-bold text-2xl text-gray-800">{project.name} の日程調整</h1>
              {isHost && (
                <NavLink to={`/${projectId}/edit`} className="btn btn-sm font-normal text-gray-600">
                  <HiOutlineCog />
                  イベント設定
                </NavLink>
              )}
            </div>
            {project.description && (
              <p className="mb-4 whitespace-pre-wrap text-gray-600 text-sm">{project.description}</p>
            )}
            <Calendar
              startDate={project.startDate}
              endDate={project.endDate}
              allowedRanges={project.allowedRanges}
              editingSlots={editMode ? editingSlots : []}
              viewingSlots={viewingSlots}
              editMode={editMode}
              onChangeEditingSlots={setEditingSlots}
            />
            <div className="flex w-full items-center justify-between gap-2 p-2">
              {editMode ? (
                <>
                  <input
                    type="text"
                    placeholder="あなたの名前"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="input flex-1 text-base"
                  />
                  <div className="flex flex-row gap-2">
                    {!!myGuestId && (
                      <button
                        type="button"
                        className="btn text-gray-500"
                        disabled={loading}
                        onClick={async () => {
                          if (confirm("更新をキャンセルします。よろしいですか？")) {
                            setEditingSlots([]);
                            setEditMode(false);
                          }
                        }}
                      >
                        キャンセル
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={loading || !guestName}
                      onClick={() => {
                        if (!guestName) return;
                        postSubmissions(
                          editingSlots.map((slot) => {
                            return { start: slot.from, end: slot.to };
                          }),
                          myGuestId ?? "",
                        );
                      }}
                    >
                      {meAsGuest ? "更新" : "提出"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <NavLink to={"/home"} className="btn btn-outline btn-primary">
                    <HiOutlineHome size={20} />
                    ホームに戻る
                  </NavLink>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={loading}
                    onClick={() => {
                      setEditMode(true);
                    }}
                  >
                    <HiPencil size={20} />
                    日程を更新する
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {toast && (
        <div className="toast toast-top toast-end z-50 mt-18">
          {toast.variant === "success" ? (
            <div className="alert border-0 bg-gray-200">
              <HiOutlineCheckCircle size={20} className="text-green-500" />
              <span>{toast.message}</span>
            </div>
          ) : (
            <div className="alert border-0 bg-gray-200">
              <HiOutlineExclamationCircle size={20} className="text-red-500" />
              <span>{toast.message}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
