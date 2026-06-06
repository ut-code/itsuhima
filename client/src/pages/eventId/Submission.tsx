import { hc } from "hono/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuCircleAlert,
  LuCircleCheck,
  LuPencil,
  LuSend,
  LuSettings2,
  LuUser,
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

  const [mode, setMode] = useState<"view" | "edit" | "confirm">("edit");

  const [guestName, setGuestName] = useState(meAsGuest?.name ?? "");

  const [editingSlots, setEditingSlots] = useState<EditingSlot[]>([]);

  const [selectedParticipationOptionId, setSelectedParticipationOptionId] = useState<string | null>(null);

  const [comment, setComment] = useState(meAsGuest?.comment ?? "");

  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [guestListExpanded, setGuestListExpanded] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const postSubmissions = useCallback(
    async (slots: { start: Date; end: Date; participationOptionId: string }[], myGuestId: string) => {
      setPostLoading(true);
      const payload = {
        name: guestName,
        comment: comment.trim() || null,
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
    [guestName, comment, projectId, fetchProject],
  );

  useEffect(() => {
    if (meAsGuest) {
      setGuestName(meAsGuest.name);
      setComment(meAsGuest.comment ?? "");
      setEditingSlots(meAsGuest.slots);
      setMode("view");
    }
  }, [meAsGuest]);

  const guestIdToName = useMemo(() => {
    if (!project) return {};
    return Object.fromEntries(project.guests.map((g) => [g.id, g.name]));
  }, [project]);

  const guestIdToComment = useMemo(() => {
    if (!project) return {};
    return Object.fromEntries(project.guests.filter((g) => g.comment).map((g) => [g.id, g.comment as string]));
  }, [project]);

  const viewingSlots = useMemo(() => {
    if (!project) return [];

    if (mode !== "view") {
      // 編集・確認モードの場合、自分のスロットは editingSlots に入るので、こちらには自分以外のスロットのみ含める
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
  }, [project, myGuestId, mode]);

  // project が読み込まれたらデフォルトの参加形態を設定
  useEffect(() => {
    if (project && project.participationOptions.length > 0 && !selectedParticipationOptionId) {
      setSelectedParticipationOptionId(project.participationOptions[0].id);
    }
  }, [project, selectedParticipationOptionId]);

  return (
    <>
      <div className="flex h-[100dvh] flex-col bg-base-200">
        <Header compact />
        {loading ? (
          <div className="flex w-full flex-1 items-center justify-center">
            <span className="loading loading-dots loading-md text-base-content/40" />
          </div>
        ) : !project ? (
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-4 px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4 rounded-xl border border-base-300 bg-base-100 p-8 text-center shadow-sm">
              <p className="text-base-content/70 text-xl">イベントが見つかりませんでした。</p>
              <NavLink to="/" className="btn btn-primary">
                ホームに戻る
              </NavLink>
            </div>
          </div>
        ) : !selectedParticipationOptionId ? (
          <div className="flex w-full flex-1 items-center justify-center">
            <span className="loading loading-dots loading-md text-base-content/40" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-2 sm:px-6 sm:py-3 lg:px-8">
              {/* プロジェクト情報 */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h1 className="min-w-0 truncate font-bold text-base text-base-content sm:text-lg">{project.name}</h1>
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
                        <p className="whitespace-pre-wrap text-base-content/70 text-sm">
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
              {mode === "edit" && project.participationOptions.length > 1 && selectedParticipationOptionId !== null && (
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
                            : {
                                backgroundColor: "var(--color-base-100)",
                                borderWidth: "2px",
                                borderColor: "var(--color-base-300)",
                              }
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
                editingSlots={mode !== "view" ? editingSlots : []}
                viewingSlots={viewingSlots}
                guestIdToName={guestIdToName}
                guestIdToComment={guestIdToComment}
                participationOptions={project.participationOptions}
                currentParticipationOptionId={selectedParticipationOptionId}
                editMode={mode === "edit"}
                onChangeEditingSlots={setEditingSlots}
              />

              {/* 参加者一覧 */}
              {project.guests.length > 0 && (
                <div className="mt-1 pb-2">
                  <button
                    type="button"
                    onClick={() => setGuestListExpanded((prev) => !prev)}
                    className="flex items-center gap-1.5 font-medium text-base-content/80 text-sm hover:text-base-content"
                  >
                    参加者 ({project.guests.length}人)
                    {guestListExpanded ? <LuChevronUp className="h-4 w-4" /> : <LuChevronDown className="h-4 w-4" />}
                  </button>
                  {guestListExpanded && (
                    <ul className="mt-1 divide-y divide-base-200">
                      {project.guests.map((guest) => {
                        const commentText = guestIdToComment[guest.id];
                        return (
                          <li key={guest.id} className="flex items-start gap-3 py-2">
                            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-300">
                              <LuUser className="h-4 w-4 text-base-content/40" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="pt-1 font-medium text-base-content text-sm">{guest.name}</p>
                              {commentText && (
                                <div className="mt-1.5 w-fit max-w-full rounded-2xl rounded-tl-none bg-base-300 px-3 py-2 text-base-content text-sm">
                                  <span className="whitespace-pre-wrap break-words">{commentText}</span>
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {mode !== "confirm" && (
              <div className="sticky bottom-0 z-10 border-base-300 border-t bg-base-100">
                <div className="mx-auto max-w-7xl px-4 py-1.5 sm:px-6 sm:py-2 lg:px-8">
                  {mode === "view" ? (
                    <div className="flex items-center justify-between">
                      <NavLink to="/home" className="btn btn-sm btn-outline gap-1.5">
                        <LuChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">ホームに戻る</span>
                        <span className="sm:hidden">ホーム</span>
                      </NavLink>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary gap-1.5"
                        disabled={loading}
                        onClick={() => {
                          if (meAsGuest?.slots) {
                            setEditingSlots(meAsGuest.slots);
                          }
                          setMode("edit");
                        }}
                      >
                        <LuPencil className="h-4 w-4" />
                        <span className="hidden sm:inline">日程を変更する</span>
                        <span className="sm:hidden">日程変更</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      {!!myGuestId && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline shrink-0"
                          disabled={loading}
                          onClick={() => {
                            setEditingSlots([]);
                            setGuestName(meAsGuest?.name ?? "");
                            setComment(meAsGuest?.comment ?? "");
                            setMode("view");
                          }}
                        >
                          <span>キャンセル</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-primary ml-auto inline-flex shrink-0 gap-1.5"
                        disabled={loading}
                        onClick={() => setMode("confirm")}
                      >
                        <span>次へ：名前を入力する</span>
                        <LuChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {project && mode === "confirm" && (
        <>
          <button
            type="button"
            aria-label="閉じる"
            className="fixed inset-0 z-20 cursor-default bg-black/20"
            onClick={() => setMode("edit")}
          />
          <div className="fixed right-0 bottom-0 left-0 z-30 rounded-t-2xl border-base-300 border-t bg-base-100 shadow-2xl">
            <div className="mx-auto max-w-7xl px-4 pt-4 pb-4 sm:px-6 lg:px-8">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-base-300" />
              <div className="mb-3 space-y-3">
                <div>
                  <label htmlFor="submit-name" className="mb-1.5 block font-medium text-base-content/80 text-sm">
                    名前 <span className="text-error">*</span>
                  </label>
                  <input
                    id="submit-name"
                    type="text"
                    placeholder="例：山田太郎"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    maxLength={50}
                    // biome-ignore lint/a11y/noAutofocus: 確認ステップへの遷移時に入力欄に自動フォーカスする
                    autoFocus
                    className="w-full rounded-lg border border-base-300 px-3 py-2 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label htmlFor="submit-comment" className="mb-1.5 block font-medium text-base-content/80 text-sm">
                    コメント（任意）
                  </label>
                  <textarea
                    id="submit-comment"
                    placeholder="一言メモなど"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="w-full resize-none rounded-lg border border-base-300 px-3 py-2 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline shrink-0 gap-1.5"
                  disabled={loading}
                  onClick={() => setMode("edit")}
                >
                  <LuChevronLeft className="h-4 w-4" />
                  <span>戻って修正</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary ml-auto inline-flex shrink-0 gap-1.5"
                  disabled={loading || !guestName}
                  onClick={() => {
                    if (!guestName) return;
                    postSubmissions(
                      editingSlots.map((slot) => ({
                        start: slot.from.toDate(),
                        end: slot.to.toDate(),
                        participationOptionId: slot.participationOptionId,
                      })),
                      myGuestId ?? "",
                    );
                  }}
                >
                  <LuSend className="h-4 w-4" />
                  <span>{meAsGuest ? "更新する" : "提出する"}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed top-20 right-4 z-50" aria-live="polite" aria-atomic="true">
          {toast.variant === "success" ? (
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-base-100 px-4 py-3 shadow-lg">
              <LuCircleCheck className="h-6 w-6 shrink-0 text-success" />
              <span className="font-medium text-base-content text-sm">{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="btn btn-circle btn-ghost btn-xs"
                aria-label="閉じる"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-base-100 px-4 py-3 shadow-lg">
              <LuCircleAlert className="h-6 w-6 shrink-0 text-error" />
              <span className="font-medium text-base-content text-sm">{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="btn btn-circle btn-ghost btn-xs"
                aria-label="閉じる"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
