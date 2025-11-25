import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { hc } from "hono/client";
import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import {
  HiClipboardCheck,
  HiClipboardCopy,
  HiInformationCircle,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineTrash,
} from "react-icons/hi";
import { NavLink, useNavigate, useParams } from "react-router";
import type { z } from "zod";
import { DEFAULT_PARTICIPATION_OPTION, generateDistinctColor } from "../../../common/colors";
import { editReqSchema, projectReqSchema } from "../../../common/validators";
import type { AppType } from "../../../server/src/main";
import Header from "../components/Header";
import { projectReviver } from "../revivers";
import type { Project } from "../types";
import { API_ENDPOINT, FRONTEND_ORIGIN } from "../utils";

const client = hc<AppType>(API_ENDPOINT);

export default function ProjectPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const formSchema = eventId ? editReqSchema : projectReqSchema;
  type FormSchemaType = z.infer<typeof formSchema>;

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    if (!eventId) {
      setProject(null);
      setProjectLoading(false);
      return;
    }
    setProjectLoading(true);
    try {
      const res = await client.projects[":projectId"].$get(
        {
          param: { projectId: eventId },
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
      console.error(error);
    } finally {
      setProjectLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const loading = projectLoading || submitLoading;

  const [dialogStatus, setDialogStatus] = useState<{
    projectId: string;
    projectName: string;
  } | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(!eventId); // 新規作成時は展開、編集時は折りたたみ
  const [isParticipationExpanded, setIsParticipationExpanded] = useState(!!eventId); // 新規作成時は折りたたみ、編集時は展開

  const {
    register,
    handleSubmit,
    control,
    reset,
    trigger,
    formState: { errors, isValid, isDirty },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      startDate: eventId ? "" : dayjs().format("YYYY-MM-DD"),
      endDate: eventId ? "" : dayjs().add(6, "day").format("YYYY-MM-DD"),
      allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
      participationOptions: eventId
        ? []
        : [
            {
              id: crypto.randomUUID(),
              label: DEFAULT_PARTICIPATION_OPTION.label,
              color: DEFAULT_PARTICIPATION_OPTION.color,
            },
          ],
    },
  });

  const handleFieldFocus = () => {
    trigger("name");
  };

  const { fields: allowedRangeFields, replace } = useFieldArray({
    control,
    name: "allowedRanges",
  });

  const {
    fields: participationFields,
    append: appendParticipation,
    remove: removeParticipation,
  } = useFieldArray({
    control,
    keyName: "fieldId", // RHF 内部のキーの名称。デフォルトの id だと participationOptions の id と衝突するため変更
    name: "participationOptions",
  });
  useEffect(() => {
    if (!eventId) return;
    if (!project) return;
    reset({
      name: project.name,
      description: project.description,
      startDate: dayjs(project.startDate).format("YYYY-MM-DD"),
      endDate: dayjs(project.endDate).format("YYYY-MM-DD"),
      allowedRanges: [
        {
          startTime: dayjs(project.allowedRanges[0].startTime).format("HH:mm"),
          endTime: dayjs(project.allowedRanges[0].endTime).format("HH:mm"),
        },
      ],
      participationOptions: project.participationOptions.map((opt) => ({
        id: opt.id,
        label: opt.label,
        color: opt.color,
      })),
    });
  }, [eventId, project, reset]);

  // 送信処理
  const onSubmit = async (data: FormSchemaType) => {
    setSubmitLoading(true);

    // 日付をISO形式に変換
    const startDateTime = new Date(`${data.startDate}T00:00:00.000`).toISOString();
    const endDateTime = new Date(`${data.endDate}T23:59:59.999`).toISOString();

    // range もISO形式に変換
    const rangeWithDateTime = data.allowedRanges?.map((range) => ({
      startTime: new Date(`${data.startDate}T${range.startTime}:00`).toISOString(),
      endTime: new Date(`${data.startDate}T${range.endTime}:00`).toISOString(),
    }));

    const eventData = {
      name: data.name ?? "",
      description: data.description ?? "",
      startDate: startDateTime,
      endDate: endDateTime,
      allowedRanges: rangeWithDateTime ?? [],
      participationOptions: (data.participationOptions ?? []).map((opt) => ({
        id: opt.id,
        label: opt.label.trim(),
        color: opt.color,
      })),
    } satisfies z.infer<typeof projectReqSchema>;

    if (!project) {
      const res = await client.projects.$post(
        {
          json: eventData,
        },
        {
          init: { credentials: "include" },
        },
      );

      setSubmitLoading(false);
      if (res.status === 201) {
        const { id, name } = await res.json();
        setDialogStatus({
          projectId: id,
          projectName: name,
        });
      } else {
        const { message } = await res.json();
        setToast({
          message,
          variant: "error",
        });
        setTimeout(() => setToast(null), 3000);
      }
    } else {
      const res = await client.projects[":projectId"].$put(
        { param: { projectId: project.id }, json: eventData },
        { init: { credentials: "include" } },
      );
      setSubmitLoading(false);
      if (res.ok) {
        // TODO: PUT のレスポンスでデータを返すことを検討
        await fetchProject();
        setToast({
          message: "更新しました。",
          variant: "success",
        });
        setTimeout(() => setToast(null), 3000);
      } else {
        let errorMessage = "更新に失敗しました。";
        try {
          const data = await res.json();
          if (data && typeof data.message === "string" && data.message.trim()) {
            errorMessage = data.message.trim();
          } else if (res.status === 403) {
            errorMessage = "権限がありません。";
          }
        } catch (_) {
          if (res.status === 403) errorMessage = "権限がありません。";
        }
        setToast({
          message: errorMessage,
          variant: "error",
        });
        setTimeout(() => setToast(null), 4000);
      }
    }
  };

  const isHost = project?.isHost;

  useEffect(() => {
    if (!loading && project && !isHost) {
      if (eventId) {
        navigate(`/e/${eventId}`);
      } else {
        navigate("/");
      }
    }
  }, [loading, project, isHost, eventId, navigate]);

  return (
    <>
      <div className="flex h-full w-full flex-col">
        <Header />
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="loading loading-dots loading-md text-gray-400" />
          </div>
        ) : eventId !== undefined && !project ? (
          <div className="flex flex-col items-center justify-center gap-4 py-4">
            <p className="text-gray-600 text-xl">イベントが見つかりませんでした。</p>
            <NavLink to={"/"} className="link">
              ホームに戻る
            </NavLink>
          </div>
        ) : (
          <div className="container mx-auto p-4">
            <h1 className="mb-2 font-bold text-2xl text-gray-800">
              {project ? `${project.name} の編集` : "イベントの作成"}
            </h1>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-18">
              <div>
                <label className="text-gray-400 text-sm" htmlFor="input-name">
                  イベント名
                </label>
                <input
                  {...register("name")}
                  id="input-name"
                  className={`input w-full text-base ${errors.name ? "input-error border-red-500" : ""}`}
                  placeholder="イベント名"
                  onBlur={() => trigger("name")}
                />
                {errors.name && <p className="mt-1 text-red-500 text-sm">{errors.name.message}</p>}
              </div>
              <div>
                <label className="text-gray-400 text-sm" htmlFor="input-description">
                  イベントの説明（任意）
                </label>
                <textarea
                  {...register("description")}
                  id="input-description"
                  className={`textarea w-full text-base ${errors.description ? "textarea-error border-red-500" : ""}`}
                  placeholder="イベントの詳細や注意事項などを入力"
                  rows={3}
                />
                {errors.description && <p className="mt-1 text-red-500 text-sm">{errors.description.message}</p>}
              </div>
              <div className="collapse-arrow collapse mb-4 border border-blue-200 bg-blue-50">
                <input type="checkbox" checked={isInfoExpanded} onChange={(e) => setIsInfoExpanded(e.target.checked)} />
                <div className="collapse-title flex items-center gap-2 font-medium text-primary text-sm">
                  <HiInformationCircle className="h-5 w-5" />
                  開始日・終了日／時間帯について
                </div>
                <div className="collapse-content text-primary text-sm">
                  <p>
                    イツヒマでは、<strong>主催者側で候補日程を設定せずに</strong>日程調整します。
                    <br />
                    ここでは、参加者の日程を知りたい日付の範囲と時間帯の範囲を設定してください。
                    <br />
                    詳しくは、
                    <a
                      href="https://utcode.notion.site/1e4ca5f557bc80f2b697ca7b9342dc89?pvs=4"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="link"
                    >
                      使い方ページ
                    </a>
                    をご覧ください。
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <div
                  className={project && project.guests.length > 0 ? "tooltip tooltip-top flex-1" : "flex-1"}
                  data-tip={
                    project && project.guests.length > 0
                      ? "すでに日程を登録したユーザーがいるため、開始日の編集はできません"
                      : ""
                  }
                >
                  <label htmlFor="input-start" className="text-gray-400 text-sm">
                    開始日
                  </label>
                  <input
                    type="date"
                    {...register("startDate")}
                    id="input-start"
                    className={`input w-full text-base ${errors.startDate ? "input-error border-red-500" : ""} ${project && project.guests.length > 0 ? "cursor-not-allowed opacity-60" : ""}`}
                    onFocus={handleFieldFocus}
                    disabled={!!(project && project.guests.length > 0)}
                  />
                  {errors.startDate && <p className="mt-1 text-red-500 text-sm">{errors.startDate.message}</p>}
                </div>
                <div
                  className={project && project.guests.length > 0 ? "tooltip tooltip-top flex-1" : "flex-1"}
                  data-tip={
                    project && project.guests.length > 0
                      ? "すでに日程を登録したユーザーがいるため、終了日の編集はできません"
                      : ""
                  }
                >
                  <label htmlFor="input-end" className="text-gray-400 text-sm">
                    終了日
                  </label>
                  <input
                    type="date"
                    {...register("endDate")}
                    id="input-end"
                    className={`input w-full text-base ${errors.endDate ? "input-error border-red-500" : ""} ${project && project.guests.length > 0 ? "cursor-not-allowed opacity-60" : ""}`}
                    onFocus={handleFieldFocus}
                    disabled={!!(project && project.guests.length > 0)}
                  />
                  {errors.endDate && <p className="mt-1 text-red-500 text-sm">{errors.endDate.message}</p>}
                </div>
              </div>
              <fieldset>
                <legend className="text-gray-400 text-sm">時間帯</legend>
                <div
                  className={project && project.guests.length > 0 ? "tooltip tooltip-top w-full" : "w-full"}
                  data-tip={
                    project && project.guests.length > 0
                      ? "すでに日程を登録したユーザーがいるため、時間帯の編集はできません"
                      : ""
                  }
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      <select
                        className={`input flex-1 text-base ${errors.allowedRanges ? "input-error border-red-500" : ""} ${project && project.guests.length > 0 ? "cursor-not-allowed opacity-60" : ""}`}
                        value={allowedRangeFields[0].startTime.split(":")[0]}
                        onChange={(e) => {
                          replace([
                            {
                              startTime: `${e.target.value}:${allowedRangeFields[0].startTime.split(":")[1]}`,
                              endTime: allowedRangeFields[0].endTime,
                            },
                          ]);
                        }}
                        onFocus={handleFieldFocus}
                        disabled={!!(project && project.guests.length > 0)}
                      >
                        <option value="" disabled>
                          時
                        </option>
                        {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")).map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <select
                        className={`input flex-1 text-base ${errors.allowedRanges ? "input-error border-red-500" : ""} ${project && project.guests.length > 0 ? "cursor-not-allowed opacity-60" : ""}`}
                        value={allowedRangeFields[0].startTime.split(":")[1]}
                        onChange={(e) => {
                          replace([
                            {
                              startTime: `${allowedRangeFields[0].startTime.split(":")[0]}:${e.target.value}`,
                              endTime: allowedRangeFields[0].endTime,
                            },
                          ]);
                        }}
                        onFocus={handleFieldFocus}
                        disabled={!!(project && project.guests.length > 0)}
                      >
                        <option value="" disabled>
                          分
                        </option>
                        {["00", "15", "30", "45"].map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span>〜</span>
                    <div className="flex flex-1 gap-1">
                      <select
                        className={`input flex-1 text-base ${errors.allowedRanges ? "input-error border-red-500" : ""} ${project && project.guests.length > 0 ? "cursor-not-allowed opacity-60" : ""}`}
                        value={allowedRangeFields[0].endTime.split(":")[0]}
                        onChange={(e) => {
                          replace([
                            {
                              startTime: allowedRangeFields[0].startTime,
                              endTime: `${e.target.value}:${allowedRangeFields[0].endTime.split(":")[1]}`,
                            },
                          ]);
                        }}
                        onFocus={handleFieldFocus}
                        disabled={!!(project && project.guests.length > 0)}
                      >
                        <option value="" disabled>
                          時
                        </option>
                        {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")).map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <select
                        className={`input flex-1 text-base ${errors.allowedRanges ? "input-error border-red-500" : ""} ${project && project.guests.length > 0 ? "cursor-not-allowed opacity-60" : ""}`}
                        value={allowedRangeFields[0].endTime.split(":")[1]}
                        onChange={(e) => {
                          replace([
                            {
                              startTime: allowedRangeFields[0].startTime,
                              endTime: `${allowedRangeFields[0].endTime.split(":")[0]}:${e.target.value}`,
                            },
                          ]);
                        }}
                        onFocus={handleFieldFocus}
                        disabled={!!(project && project.guests.length > 0)}
                      >
                        <option value="" disabled>
                          分
                        </option>
                        {["00", "15", "30", "45"].map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {errors.allowedRanges && typeof errors.allowedRanges?.message === "string" && (
                  <p className="mt-1 text-red-500 text-sm">{errors.allowedRanges.message}</p>
                )}
              </fieldset>
              <div className="collapse-arrow collapse mb-4 border border-base-300 bg-base-200">
                <input
                  type="checkbox"
                  checked={isParticipationExpanded}
                  onChange={(e) => setIsParticipationExpanded(e.target.checked)}
                />
                <div className="collapse-title font-medium text-sm">参加形態の設定 (任意)</div>
                <div className="collapse-content">
                  <fieldset>
                    <p className="mb-2 text-gray-500 text-xs">
                      参加形態を設定すると、参加者は「対面」「オンライン」などの形態を選んで日程を登録できます。
                    </p>

                    {participationFields.map((field, index) => {
                      const hasSlots = project?.guests.some((guest) =>
                        guest.slots.some((slot) => slot.participationOptionId === field.id),
                      );
                      const isLastOption = participationFields.length === 1;
                      const cannotDelete = hasSlots || isLastOption;
                      const tooltipMessage = hasSlots
                        ? "すでにこの参加形態の日程が登録されているため、削除できません"
                        : isLastOption
                          ? "最低1つの参加形態が必要です"
                          : "";
                      return (
                        <div key={field.id} className="mb-2 w-full">
                          <div className="flex items-center gap-2">
                            <input type="hidden" {...register(`participationOptions.${index}.id`)} value={field.id} />
                            <input
                              type="color"
                              {...register(`participationOptions.${index}.color`)}
                              defaultValue={field.color}
                              className="h-10 w-10 cursor-pointer rounded border-0"
                            />
                            <input
                              type="text"
                              {...register(`participationOptions.${index}.label`)}
                              defaultValue={field.label}
                              placeholder="参加形態名（例：対面、オンライン）"
                              className={`input input-bordered flex-1 text-base ${errors.participationOptions?.[index]?.label ? "input-error border-red-500" : ""}`}
                              onBlur={() => {
                                // 値を変更していない場合でも空ならエラー表示させるため手動で検証
                                trigger(`participationOptions.${index}.label` as const);
                              }}
                            />
                            <div className={cannotDelete ? "tooltip tooltip-left" : ""} data-tip={tooltipMessage}>
                              <button
                                type="button"
                                onClick={() => removeParticipation(index)}
                                className={`btn btn-ghost btn-sm text-error ${cannotDelete ? "cursor-not-allowed opacity-40" : ""}`}
                                disabled={cannotDelete}
                              >
                                <HiOutlineTrash size={20} />
                              </button>
                            </div>
                          </div>
                          {errors.participationOptions?.[index]?.label && (
                            <p className="mt-1 text-red-500 text-xs">
                              {errors.participationOptions[index]?.label?.message as string}
                            </p>
                          )}
                          {errors.participationOptions?.[index]?.color && (
                            <p className="mt-1 text-red-500 text-xs">
                              {errors.participationOptions[index]?.color?.message as string}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        const existingColors = participationFields.map((o) => o.color);
                        appendParticipation({
                          id: crypto.randomUUID(),
                          label: "",
                          color: generateDistinctColor(existingColors),
                        });
                      }}
                      className="btn btn-outline btn-sm"
                    >
                      + 参加形態を追加
                    </button>
                  </fieldset>
                </div>
              </div>
              {project && (
                <fieldset>
                  <legend className="text-gray-400 text-sm">イベントの削除</legend>
                  <div className="flex justify-end py-2">
                    <button
                      type="button"
                      id="delete-button"
                      className="btn btn-ghost text-error"
                      onClick={async () => {
                        if (confirm("本当にこのイベントを削除しますか？")) {
                          try {
                            const res = await client.projects[":projectId"].$delete(
                              { param: { projectId: project.id } },
                              { init: { credentials: "include" } },
                            );
                            if (!res.ok) {
                              throw new Error("削除に失敗しました。");
                            }
                            navigate("/home");
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
                      }}
                    >
                      <HiOutlineTrash size={20} />
                      イベントを削除する
                    </button>
                  </div>
                </fieldset>
              )}
              <div className="fixed bottom-0 left-0 flex max-h-18 w-full justify-between bg-white p-4 shadow-[0_-2px_8px_rgba(0,0,0,0.1)]">
                {eventId ? (
                  <NavLink to={`/e/${eventId}`} className="btn btn-outline btn-primary">
                    日程調整に戻る
                  </NavLink>
                ) : (
                  <NavLink to={"/home"} className="btn btn-outline btn-primary">
                    ホームに戻る
                  </NavLink>
                )}
                <button type="submit" className="btn btn-primary" disabled={!isValid || !isDirty}>
                  イベントを{project ? "更新" : "作成"}する
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      {dialogStatus !== null && (
        <div className="modal modal-open">
          <div className="modal-box flex flex-col gap-2">
            <h3 className="text-xl">{dialogStatus.projectName}を作成しました</h3>
            <p className="py-4">URL をコピーして共有しましょう！</p>
            <div className="flex gap-1">
              <input
                type="text"
                disabled
                className="input input-info w-full"
                value={`${FRONTEND_ORIGIN}/e/${dialogStatus.projectId}`}
              />
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${FRONTEND_ORIGIN}/e/${dialogStatus.projectId}`);
                  setCopied(true);
                  setTimeout(() => {
                    setCopied(false);
                  }, 2000);
                }}
                className="btn btn-outline btn-primary"
                disabled={copied}
              >
                {!copied ? <HiClipboardCopy size={20} /> : <HiClipboardCheck size={20} />} コピー
              </button>
            </div>
            <div className="modal-action">
              <NavLink className="btn btn-primary" to={`/e/${dialogStatus.projectId}`}>
                イベントへ
              </NavLink>
            </div>
          </div>
        </div>
      )}
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
