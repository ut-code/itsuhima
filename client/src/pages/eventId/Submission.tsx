import { hc } from "hono/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronUp,
  LuCircleAlert,
  LuCircleCheck,
  LuPencil,
  LuSend,
  LuSettings2,
  LuX,
} from "react-icons/lu";
import { NavLink, useParams } from "react-router";
import type { AppType } from "../../../../server/src/main";
import { Calendar } from "../../components/Calendar";
import Header from "../../components/Header";
import { projectReviver } from "../../revivers";
import type { Project, Slot } from "../../types";
import { API_ENDPOINT } from "../../utils";

const client = hc<AppType>(API_ENDPOINT);

export type EditingSlot = Pick<Slot, "from" | "to" | "participationOptionId">;

/**
 * テキストを簡易的に切り詰める。
 * - ASCII なら 1, 非 ASCII なら 2。
 * - 改行コード数も考慮。
 */
const truncateText = (text: string, maxWidth = 80, maxLines = 3): { text: string; truncated: boolean } => {
  const lines = text.split("\n");
  let width = 0;
  let result = "";
  let lineCount = 0;

  for (const line of lines) {
    if (lineCount >= maxLines) {
      return { text: `${result.trimEnd()}…`, truncated: true };
    }

    if (lineCount > 0) {
      result += "\n";
    }

    for (const char of line) {
      const charWidth = char.charCodeAt(0) < 128 ? 1 : 2;
      if (width + charWidth > maxWidth) {
        return { text: `${result.trimEnd()}…`, truncated: true };
      }
      width += charWidth;
      result += char;
    }

    lineCount++;
  }

  return { text: result, truncated: false };
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null;
};

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
      } else {
        let errorMessage = "プロジェクトの取得に失敗しました。";
        try {
          const data = await res.json();
          if (data && typeof data.message === "string" && data.message.trim()) {
            errorMessage = data.message.trim();
          }
        } catch (_) {
          // レスポンスがJSONでない場合は無視
        }
        setToast({
          message: errorMessage,
          variant: "error",
        });
        setTimeout(() => setToast(null), 5000);
      }
    } catch (error) {
      console.error("Error fetching project:", error);
      setToast({
        message: "ネットワークエラーが発生しました。",
        variant: "error",
      });
      setTimeout(() => setToast(null), 5000);
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

  const [selectedParticipationOptionId, setSelectedParticipationOptionId] = useState<string | null>(null);

  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const postSubmissions = useCallback(
    async (slots: { start: Date; end: Date; participationOptionId: string }[], myGuestId: string) => {
      setPostLoading(true);
      const payload = {
        name: guestName,
        projectId: projectId || "",
        slots: slots.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          participationOptionId: slot.participationOptionId,
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
      setEditingSlots(project.meAsGuest.slots);
    }
  }, [project, editMode]);

  const guestIdToName = useMemo(() => {
    if (!project) return {};
    return Object.fromEntries(project.guests.map((g) => [g.id, g.name]));
  }, [project]);

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
            guestId: g.id,
            optionId: s.participationOptionId,
          })),
        );
    }

    // 閲覧モードの場合は自分も含めて全て
    return project.guests.flatMap((g) =>
      g.slots.map((s) => ({
        from: s.from,
        to: s.to,
        guestId: g.id,
        optionId: s.participationOptionId,
      })),
    );
  }, [project, myGuestId, editMode]);
  // project が読み込まれたらデフォルトの参加形態を設定
  useEffect(() => {
    if (project && project.participationOptions.length > 0 && !selectedParticipationOptionId) {
      setSelectedParticipationOptionId(project.participationOptions[0].id);
    }
  }, [project, selectedParticipationOptionId]);

  return (
    <>
      <div className="flex h-[100dvh] flex-col bg-slate-50">
        <Header />
        {loading ? (
          <div className="flex w-full flex-1 items-center justify-center">
            <span className="loading loading-dots loading-md text-slate-400" />
          </div>
        ) : !project ? (
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-4 px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-slate-600 text-xl">イベントが見つかりませんでした。</p>
              <NavLink to="/" className="btn btn-primary">
                ホームに戻る
              </NavLink>
            </div>
          </div>
        ) : !selectedParticipationOptionId ? (
          <div className="flex w-full flex-1 items-center justify-center">
            <span className="loading loading-dots loading-md text-slate-400" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
              {/* プロジェクト情報 */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h1 className="truncate font-bold text-base text-slate-900 sm:text-lg">{project.name}</h1>
                  {isHost && (
                    <NavLink to={`/e/${projectId}/edit`} className="btn btn-sm btn-outline shrink-0 gap-1.5">
                      <LuSettings2 className="h-4 w-4" />
                      <span>編集</span>
                    </NavLink>
                  )}
                </div>
                {project.description &&
                  (() => {
                    const { text: truncatedText, truncated } = truncateText(project.description);
                    return (
                      <div className="mt-2 sm:mt-3">
                        <p className="whitespace-pre-wrap text-slate-600 text-sm">
                          {descriptionExpanded ? project.description : truncatedText}
                        </p>
                        {truncated && (
                          <button
                            type="button"
                            onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                            className="mt-1 inline-flex items-center gap-0.5 text-primary text-sm hover:underline"
                          >
                            {descriptionExpanded ? (
                              <>
                                閉じる
                                <LuChevronUp className="h-4 w-4" />
                              </>
                            ) : (
                              <>
                                もっと見る
                                <LuChevronDown className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })()}
              </div>

              {/* 参加形態選択ボタン */}
              {editMode && project.participationOptions.length > 1 && selectedParticipationOptionId !== null && (
                <div className="mt-3 mb-2 flex flex-wrap items-center gap-1.5">
                  {project.participationOptions.map((opt) => {
                    const rgb = hexToRgb(opt.color);
                    const lightBg = rgb
                      ? `rgba(${rgb.r * 0.2 + 255 * 0.8}, ${rgb.g * 0.2 + 255 * 0.8}, ${rgb.b * 0.2 + 255 * 0.8}, 1)`
                      : undefined;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className="btn btn-sm gap-1.5"
                        onClick={() => setSelectedParticipationOptionId(opt.id)}
                        style={
                          selectedParticipationOptionId === opt.id
                            ? { backgroundColor: lightBg, borderWidth: "2px", borderColor: opt.color }
                            : { backgroundColor: "white", borderWidth: "2px", borderColor: "#e2e8f0" }
                        }
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full sm:h-3 sm:w-3"
                          style={{ backgroundColor: opt.color }}
                        />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <Calendar
                startDate={project.startDate}
                endDate={project.endDate}
                allowedRanges={project.allowedRanges}
                editingSlots={editMode ? editingSlots : []}
                viewingSlots={viewingSlots}
                guestIdToName={guestIdToName}
                participationOptions={project.participationOptions}
                currentParticipationOptionId={selectedParticipationOptionId}
                editMode={editMode}
                onChangeEditingSlots={setEditingSlots}
              />
            </div>

            <div className="sticky bottom-0 z-10 border-slate-200 border-t bg-white">
              <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 sm:py-3 lg:px-8">
                {editMode ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="名前"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-2.5"
                    />
                    {!!myGuestId && (
                      <button
                        type="button"
                        className="btn btn-outline shrink-0"
                        disabled={loading}
                        onClick={async () => {
                          if (confirm("更新をキャンセルします。よろしいですか？")) {
                            setEditingSlots([]);
                            setEditMode(false);
                          }
                        }}
                      >
                        <span>キャンセル</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary inline-flex shrink-0 gap-1.5 sm:gap-2"
                      disabled={loading || !guestName}
                      onClick={() => {
                        if (!guestName) return;
                        postSubmissions(
                          editingSlots.map((slot) => ({
                            start: slot.from,
                            end: slot.to,
                            participationOptionId: slot.participationOptionId,
                          })),
                          myGuestId ?? "",
                        );
                      }}
                    >
                      <LuSend className="sm:h-5 sm:w-5" />
                      <span>{meAsGuest ? "更新" : "提出"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <NavLink to="/home" className="btn btn-outline gap-1.5 sm:gap-2">
                      <LuChevronLeft className="sm:h-5 sm:w-5" />
                      <span className="hidden sm:inline">ホームに戻る</span>
                      <span className="sm:hidden">ホーム</span>
                    </NavLink>
                    <button
                      type="button"
                      className="btn btn-primary gap-1.5 sm:gap-2"
                      disabled={loading}
                      onClick={() => {
                        setEditMode(true);
                      }}
                    >
                      <LuPencil className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="hidden sm:inline">日程を更新する</span>
                      <span className="sm:hidden">日程更新</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed top-20 right-4 z-50">
          {toast.variant === "success" ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
              <LuCircleCheck className="h-6 w-6 shrink-0 text-emerald-600" />
              <span className="font-medium text-emerald-900 text-sm">{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} className="btn btn-circle btn-ghost btn-xs">
                <LuX className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-lg">
              <LuCircleAlert className="h-6 w-6 shrink-0 text-red-600" />
              <span className="font-medium text-red-900 text-sm">{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} className="btn btn-circle btn-ghost btn-xs">
                <LuX className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
