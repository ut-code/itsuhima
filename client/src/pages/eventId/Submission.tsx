import { hc } from "hono/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuCircleAlert,
  LuCircleCheck,
  LuHistory,
  LuLock,
  LuPencil,
  LuSend,
  LuSettings2,
  LuTrash2,
  LuUser,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { NavLink, useParams } from "react-router";
import type { AppType } from "../../../../server/src/routes/api";
import { AddToCalendar } from "../../components/AddToCalendar";
import { AnonymousEditNotice } from "../../components/AnonymousEditNotice";
import { Calendar, type Highlight } from "../../components/Calendar";
import { DeletedEvent } from "../../components/DeletedEvent";
import Header from "../../components/Header";
import { HistoryDialog, type HistoryDialogHandle } from "../../components/HistoryDialog";
import { OwnershipHint } from "../../components/OwnershipHint";
import { authClient } from "../../lib/auth";
import { findMyEvent, forgetMyEvents, forgetMyParticipant, rememberMyEvent } from "../../lib/myEvents";
import { eventReviver } from "../../revivers";
import type { Event, Participant, Slot } from "../../types";
import { API_ENDPOINT, readErrorMessage } from "../../utils";

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
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  /** 削除されたイベントなら、その名前などが入る */
  const [deletedEvent, setDeletedEvent] = useState<{ name: string; purgeAt: string; canRestore: boolean } | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const loggedIn = !!session;
  /**
   * 自分の回答の id。ログイン中は、ログインして出した回答 (`isMine`)。
   * していなければ、このブラウザから出した回答 (localStorage の控え)。権限には使わない
   */
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);

  const [postLoading, setPostLoading] = useState(false);

  const loading = eventLoading || postLoading;

  const fetchEvent = useCallback(async () => {
    if (!eventId) {
      setEvent(null);
      setEventLoading(false);
      return;
    }
    setEventLoading(true);
    try {
      const res = await client.events[":eventId"].$get(
        {
          param: { eventId },
        },
        {
          init: { credentials: "include" },
        },
      );
      // 404 はサーバーの型に乗らない (ServiceError を onError で返す) ので、数値として比べる
      const notFound = (res.status as number) === 404;
      if (res.status === 200) {
        const data = await res.json();
        const parsedData = eventReviver(data);
        setEvent(parsedData);
        setDeletedEvent(null);
      } else if (res.status === 410) {
        const { name, purgeAt, canRestore } = await res.json();
        setEvent(null);
        setDeletedEvent({ name, purgeAt, canRestore });
      } else {
        if (notFound) {
          forgetMyEvents([eventId]);
        }
        const errorMessage = await readErrorMessage(res, "イベントの取得に失敗しました。");
        setToast({
          message: errorMessage,
          variant: "error",
        });
        setTimeout(() => setToast(null), 5000);
      }
    } catch (error) {
      console.error("Error fetching event:", error);
      setToast({
        message: "ネットワークエラーが発生しました。",
        variant: "error",
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setEventLoading(false);
    }
  }, [eventId]);
  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // 自分の回答を決める。控えは、ログインしていないとわかったときだけ読み書きする
  useEffect(() => {
    if (!eventId || !event || sessionPending) return;
    if (loggedIn) {
      setMyParticipantId(event.participants.find((p) => p.isMine)?.id ?? null);
      return;
    }
    // 開いたイベントは、ホームの一覧に出す
    rememberMyEvent({ id: eventId, isHost: false });
    const remembered = findMyEvent(eventId)?.participantId;
    if (remembered && !event.participants.some((p) => p.id === remembered)) {
      // 自分の回答が、ほかの人に消された
      forgetMyParticipant(eventId);
    }
    setMyParticipantId(findMyEvent(eventId)?.participantId ?? null);
  }, [eventId, event, loggedIn, sessionPending]);

  const historyDialogRef = useRef<HistoryDialogHandle>(null);
  const showToast = useCallback((message: string, variant: "success" | "error") => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 3000);
  }, []);
  const onHistoryRestored = useCallback(
    async (message: string) => {
      showToast(message, "success");
      await fetchEvent();
    },
    [fetchEvent, showToast],
  );
  const onHistoryError = useCallback((message: string) => showToast(message, "error"), [showToast]);

  const [restoring, setRestoring] = useState(false);
  const restoreEvent = useCallback(async () => {
    if (!eventId) return;
    setRestoring(true);
    try {
      const res = await client.events[":eventId"].restore.$post(
        { param: { eventId } },
        { init: { credentials: "include" } },
      );
      if (res.ok) {
        setToast({ message: "イベントを元に戻しました。", variant: "success" });
        await fetchEvent();
      } else {
        setToast({ message: await readErrorMessage(res, "元に戻せませんでした。"), variant: "error" });
      }
    } catch (error) {
      console.error("Error restoring event:", error);
      setToast({ message: "ネットワークエラーが発生しました。", variant: "error" });
    } finally {
      setRestoring(false);
      setTimeout(() => setToast(null), 3000);
    }
  }, [eventId, fetchEvent]);

  const me = event?.participants.find((p) => p.id === myParticipantId) ?? null;
  /** 「日程を変更する」で編集する自分の回答。ログインして出した回答は、ログアウトすると編集できない */
  const editableMe = me?.canEdit ? me : null;

  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  /** 編集している回答の id。null なら新しい回答 */
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const editingParticipant = event?.participants.find((p) => p.id === editingParticipantId) ?? null;

  const [guestName, setGuestName] = useState("");

  const [editingSlots, setEditingSlots] = useState<EditingSlot[]>([]);

  const [selectedParticipationOptionId, setSelectedParticipationOptionId] = useState<string | null>(null);

  const [comment, setComment] = useState("");

  const [highlight, setHighlight] = useState<Highlight | null>(null);

  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [guestListExpanded, setGuestListExpanded] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  /** 回答を編集し始める。participant が null なら新しい回答 */
  const startEditing = useCallback((participant: Participant | null) => {
    setEditingParticipantId(participant?.id ?? null);
    setGuestName(participant?.name ?? "");
    setComment(participant?.comment ?? "");
    setEditingSlots(participant?.slots ?? []);
    setMode("edit");
  }, []);

  const stopEditing = useCallback(() => {
    setEditingParticipantId(null);
    setEditingSlots([]);
    setMode("view");
  }, []);

  const postSubmissions = useCallback(
    async (slots: { start: Date; end: Date; participationOptionId: string }[]) => {
      if (!eventId) return;
      setPostLoading(true);
      const payload = {
        name: guestName,
        comment: comment.trim() || null,
        slots: slots.map((slot) => ({
          startAt: slot.start.toISOString(),
          endAt: slot.end.toISOString(),
          optionId: slot.participationOptionId,
        })),
      };
      try {
        const response = editingParticipantId
          ? await client.events[":eventId"].participants[":participantId"].$put({
              param: { eventId, participantId: editingParticipantId },
              json: payload,
            })
          : await client.events[":eventId"].participants.$post({ param: { eventId }, json: payload });
        if (response.ok) {
          if (!editingParticipantId) {
            const { participant } = await response.json();
            // 匿名で出せた回答だけを控える
            if (!loggedIn && !participant.hasOwner) {
              rememberMyEvent({ id: eventId, isHost: false, participantId: participant.id });
            }
          }
          showToast(editingParticipantId ? "更新しました。" : "提出しました。", "success");
          stopEditing();
        } else {
          showToast(
            await readErrorMessage(
              response,
              editingParticipantId
                ? "更新に失敗しました。もう一度お試しください。"
                : "提出に失敗しました。もう一度お試しください。",
            ),
            "error",
          );
        }
      } catch (error) {
        console.error("Error submitting:", error);
        showToast("ネットワークエラーが発生しました。", "error");
      }
      await fetchEvent();
      setPostLoading(false);
    },
    [guestName, comment, eventId, editingParticipantId, loggedIn, fetchEvent, showToast, stopEditing],
  );

  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  /** 削除の確認をしている回答 */
  const [deletingParticipant, setDeletingParticipant] = useState<Participant | null>(null);
  const confirmDelete = useCallback((participant: Participant) => {
    setDeletingParticipant(participant);
    deleteDialogRef.current?.showModal();
  }, []);
  const deleteParticipant = useCallback(async () => {
    if (!eventId || !deletingParticipant) return;
    const participantId = deletingParticipant.id;
    deleteDialogRef.current?.close();
    setPostLoading(true);
    try {
      const res = await client.events[":eventId"].participants[":participantId"].$delete({
        param: { eventId, participantId },
      });
      if (res.ok) {
        if (!loggedIn && participantId === myParticipantId) {
          forgetMyParticipant(eventId);
        }
        showToast("回答を削除しました。「履歴」から元に戻せます。", "success");
        stopEditing();
      } else {
        showToast(await readErrorMessage(res, "削除に失敗しました。"), "error");
      }
    } catch (error) {
      console.error("Error deleting participant:", error);
      showToast("ネットワークエラーが発生しました。", "error");
    }
    await fetchEvent();
    setPostLoading(false);
  }, [eventId, deletingParticipant, myParticipantId, loggedIn, fetchEvent, showToast, stopEditing]);

  // 編集・確認モードではベールがドラッグ入力の邪魔になるため解除する
  useEffect(() => {
    if (mode !== "view") setHighlight(null);
  }, [mode]);

  const participantIdToName = useMemo(() => {
    if (!event) return {};
    return Object.fromEntries(event.participants.map((p) => [p.id, p.name]));
  }, [event]);

  const participantIdToComment = useMemo(() => {
    if (!event) return {};
    return Object.fromEntries(event.participants.filter((p) => p.comment).map((p) => [p.id, p.comment as string]));
  }, [event]);

  const participationOptionIdToLabel = useMemo(() => {
    if (!event) return {};
    return Object.fromEntries(event.options.map((opt) => [opt.id, opt.label]));
  }, [event]);

  const viewingSlots = useMemo(() => {
    if (!event) return [];

    if (mode !== "view") {
      // 編集・確認モードの場合、編集している回答のスロットは editingSlots に入るので、こちらにはそれ以外のスロットのみ含める
      return event.participants
        .filter((g) => g.id !== editingParticipantId)
        .flatMap((g) =>
          g.slots.map((s) => ({
            from: s.from,
            to: s.to,
            participantId: g.id,
            optionId: s.participationOptionId,
          })),
        );
    }

    // 閲覧モードの場合は自分も含めて全て
    return event.participants.flatMap((g) =>
      g.slots.map((s) => ({
        from: s.from,
        to: s.to,
        participantId: g.id,
        optionId: s.participationOptionId,
      })),
    );
  }, [event, editingParticipantId, mode]);

  // event が読み込まれたらデフォルトの参加形態を設定
  useEffect(() => {
    if (event && event.options.length > 0 && !selectedParticipationOptionId) {
      setSelectedParticipationOptionId(event.options[0].id);
    }
  }, [event, selectedParticipationOptionId]);

  return (
    <>
      <div className="flex h-dvh flex-col bg-base-200">
        <Header compact />
        {loading ? (
          <div className="flex w-full flex-1 items-center justify-center">
            <span className="loading loading-dots loading-md text-base-content/40" />
          </div>
        ) : deletedEvent ? (
          <DeletedEvent
            name={deletedEvent.name}
            purgeAt={deletedEvent.purgeAt}
            canRestore={deletedEvent.canRestore}
            restoring={restoring}
            onRestore={restoreEvent}
          />
        ) : !event ? (
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-4 px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex min-h-100 w-full flex-col items-center justify-center gap-4 rounded-xl border border-base-300 bg-base-100 p-8 text-center shadow-sm">
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
              {/* イベント情報 */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h1 className="min-w-0 truncate font-bold text-base text-base-content sm:text-lg">{event.name}</h1>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* 自分の日程をカレンダーアプリに追加 */}
                    {mode === "view" && me && me.slots.length > 0 && (
                      <AddToCalendar
                        eventName={event.name}
                        eventId={eventId ?? ""}
                        eventDescription={event.description}
                        slots={me.slots}
                        participationOptionIdToLabel={participationOptionIdToLabel}
                        participationOptionCount={event.options.length}
                      />
                    )}
                    {mode === "view" && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline shrink-0 gap-1.5"
                        aria-label="変更の履歴"
                        onClick={() => historyDialogRef.current?.open()}
                      >
                        <LuHistory className="h-4 w-4" />
                        <span className="hidden sm:inline">履歴</span>
                      </button>
                    )}
                    {event.canEdit && (
                      <NavLink to={`/e/${eventId}/edit`} className="btn btn-sm btn-outline shrink-0 gap-1.5">
                        <LuSettings2 className="h-4 w-4" />
                        <span>編集</span>
                      </NavLink>
                    )}
                  </div>
                </div>
                {event.description &&
                  (() => {
                    const { text: truncatedText, truncated } = truncateText(event.description);
                    return (
                      <div className="mt-2 sm:mt-3">
                        <p className="whitespace-pre-wrap text-base-content/70 text-sm">
                          {descriptionExpanded ? event.description : truncatedText}
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

              {mode === "view" && !event.hasOwner && <AnonymousEditNotice />}

              {/* 参加形態選択ボタン */}
              {mode === "edit" && event.options.length > 1 && selectedParticipationOptionId !== null && (
                <div className="mt-3 mb-2 flex flex-wrap items-center gap-1.5">
                  {event.options.map((opt) => {
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
                startDate={event.startDate}
                endDate={event.endDate}
                allowedRanges={event.allowedRanges}
                editingSlots={mode !== "view" ? editingSlots : []}
                viewingSlots={viewingSlots}
                participantIdToName={participantIdToName}
                participantIdToComment={participantIdToComment}
                participationOptions={event.options}
                currentParticipationOptionId={selectedParticipationOptionId}
                highlight={mode === "view" ? highlight : null}
                editMode={mode === "edit"}
                onChangeEditingSlots={setEditingSlots}
              />

              {/* 参加者一覧 */}
              {event.participants.length > 0 && (
                <div className="mt-1 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setGuestListExpanded((prev) => !prev)}
                      className="flex min-w-0 items-center gap-1.5 font-medium text-base-content/80 text-sm hover:text-base-content"
                    >
                      参加者 ({event.participants.length}人)
                      {guestListExpanded ? <LuChevronUp className="h-4 w-4" /> : <LuChevronDown className="h-4 w-4" />}
                    </button>
                    {/* ハイライト操作（カレンダーの縦幅を使わないようこの行に置く） */}
                    {mode === "view" && (
                      <div className="flex min-w-0 items-center gap-1.5">
                        {highlight?.type === "guest" && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary min-w-0 gap-1.5"
                            onClick={() => setHighlight(null)}
                          >
                            <LuUser className="h-4 w-4 shrink-0" />
                            <span className="truncate">{participantIdToName[highlight.participantId] ?? "参加者"}</span>
                            <LuX className="h-4 w-4 shrink-0" />
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn btn-sm shrink-0 gap-1.5 ${
                            highlight?.type === "maxCount" ? "btn-primary" : "btn-outline"
                          }`}
                          onClick={() =>
                            setHighlight((prev) => (prev?.type === "maxCount" ? null : { type: "maxCount" }))
                          }
                        >
                          <LuUsers className="h-4 w-4" />
                          最多人数
                        </button>
                      </div>
                    )}
                  </div>
                  {guestListExpanded && (
                    <ul className="mt-1 divide-y divide-base-200">
                      {event.participants.map((guest) => {
                        const commentText = participantIdToComment[guest.id];
                        const isHighlighted = highlight?.type === "guest" && highlight.participantId === guest.id;
                        return (
                          <li key={guest.id} className="flex items-start gap-1">
                            <button
                              type="button"
                              aria-pressed={isHighlighted}
                              onClick={() =>
                                setHighlight(isHighlighted ? null : { type: "guest", participantId: guest.id })
                              }
                              className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                                isHighlighted ? "bg-primary/10" : "hover:bg-base-200"
                              }`}
                            >
                              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-300">
                                <LuUser className="h-4 w-4 text-base-content/40" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="pt-1 font-medium text-base-content text-sm">
                                  {guest.name}
                                  {guest.ownerDeleted ? (
                                    <span className="ml-1.5 font-normal text-base-content/50 text-xs">
                                      (削除されたアカウント)
                                    </span>
                                  ) : (
                                    guest.hasOwner && (
                                      <LuLock
                                        className="ml-1 inline h-3 w-3 align-baseline text-base-content/40"
                                        aria-label="ログインした人の回答 (本人だけが編集できます)"
                                      />
                                    )
                                  )}
                                  {guest.id === myParticipantId && (
                                    <span className="ml-1.5 font-normal text-base-content/50 text-xs">(あなた)</span>
                                  )}
                                </p>
                                {commentText && (
                                  <div className="mt-1.5 w-fit max-w-full rounded-2xl rounded-tl-none bg-base-300 px-3 py-2 text-base-content text-sm">
                                    <span className="wrap-break-word whitespace-pre-wrap">{commentText}</span>
                                  </div>
                                )}
                              </div>
                            </button>
                            {/* URL を知っている人は誰でも、ほかの人の回答も編集できる (書き間違いの代理の修正など) */}
                            {mode === "view" && guest.canEdit && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm mt-2 shrink-0 gap-1 text-base-content/70"
                                aria-label={`${guest.name}の回答を編集`}
                                disabled={loading}
                                onClick={() => startEditing(guest)}
                              >
                                <LuPencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">編集</span>
                              </button>
                            )}
                            {/* ログインして作ったイベントの持ち主は、ログインした人の回答を消すことだけできる。
                                アカウントを削除した人の回答も、イベントを編集できる人は消すことだけできる */}
                            {mode === "view" && !guest.canEdit && guest.canDelete && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm mt-2 shrink-0 gap-1 text-error"
                                aria-label={`${guest.name}の回答を削除`}
                                disabled={loading}
                                onClick={() => confirmDelete(guest)}
                              >
                                <LuTrash2 className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">削除</span>
                              </button>
                            )}
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
                        onClick={() => startEditing(editableMe)}
                      >
                        <LuPencil className="h-4 w-4" />
                        {editableMe ? (
                          <>
                            <span className="hidden sm:inline">日程を変更する</span>
                            <span className="sm:hidden">日程変更</span>
                          </>
                        ) : (
                          <span>入力する</span>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline shrink-0"
                        disabled={loading}
                        onClick={stopEditing}
                      >
                        <span>キャンセル</span>
                      </button>
                      {editingParticipant && (
                        <span className="min-w-0 truncate text-base-content/70 text-sm">
                          「{editingParticipant.name}」の回答を編集中
                        </span>
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

      {event && mode === "confirm" && (
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
                {!editingParticipant && <OwnershipHint target="answer" />}
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
                {editingParticipant?.canDelete && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost shrink-0 gap-1.5 text-error"
                    disabled={loading}
                    onClick={() => confirmDelete(editingParticipant)}
                  >
                    <LuTrash2 className="h-4 w-4" />
                    <span>回答を削除</span>
                  </button>
                )}
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
                    );
                  }}
                >
                  <LuSend className="h-4 w-4" />
                  <span>{editingParticipant ? "更新する" : "提出する"}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 回答の削除の確認 */}
      <dialog ref={deleteDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="mb-2 font-bold text-base-content text-lg">
            「{deletingParticipant?.name}」の回答を削除しますか？
          </h3>
          <p className="mb-6 text-base-content/70 text-sm">削除したあとも、「履歴」から元に戻せます。</p>
          <div className="modal-action">
            <button type="button" className="btn btn-outline" onClick={() => deleteDialogRef.current?.close()}>
              キャンセル
            </button>
            <button
              type="button"
              className="btn gap-1.5 bg-error text-white hover:bg-error/90"
              onClick={deleteParticipant}
            >
              <LuTrash2 className="h-4 w-4" />
              削除する
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">閉じる</button>
        </form>
      </dialog>

      {event && (
        <HistoryDialog
          ref={historyDialogRef}
          eventId={event.id}
          optionIdToLabel={participationOptionIdToLabel}
          onRestored={onHistoryRestored}
          onError={onHistoryError}
        />
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
