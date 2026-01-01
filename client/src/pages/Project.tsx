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
import { EXTERNAL_LINKS } from "../constants/links";

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
      console.error(error);
      setToast({
        message: "ネットワークエラーが発生しました。",
        variant: "error",
      });
      setTimeout(() => setToast(null), 5000);
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

  // TODO: グローバルにしないと、delete の際は遷移を伴うので表示されない
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
        setToast({
          message: "イベントの作成に失敗しました。",
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
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Header />
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <span className="loading loading-dots loading-md text-slate-400" />
          </div>
        ) : eventId !== undefined && !project ? (
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-base text-slate-600 sm:text-xl">イベントが見つかりませんでした。</p>
              <NavLink
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-sm text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md sm:px-6 sm:py-2.5"
              >
                ホームに戻る
              </NavLink>
            </div>
          </div>
        ) : (
          <main className="mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6 lg:px-8">
            <div className="mb-6">
              <h1 className="font-bold text-slate-900 text-xl tracking-tight sm:text-2xl">
                {project ? `${project.name} の編集` : "イベントの作成"}
              </h1>
              <p className="mt-1.5 text-slate-500 text-sm">
                {project ? "イベントの詳細を編集できます" : "新しい日程調整イベントを作成しましょう"}
              </p>
            </div>

            <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* 基本情報 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-semibold text-base text-slate-900 sm:text-lg">基本情報</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block font-medium text-slate-700 text-sm" htmlFor="input-name">
                      イベント名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("name")}
                      id="input-name"
                      className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-2.5 sm:text-base ${errors.name ? "border-red-500" : "border-slate-300"}`}
                      placeholder="例: 3月度 同期飲み会"
                      onBlur={() => trigger("name")}
                    />
                    {errors.name && <p className="mt-1.5 text-red-600 text-sm">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="mb-2 block font-medium text-slate-700 text-sm" htmlFor="input-description">
                      イベントの説明（任意）
                    </label>
                    <textarea
                      {...register("description")}
                      id="input-description"
                      className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-2.5 sm:text-base ${errors.description ? "border-red-500" : "border-slate-300"}`}
                      placeholder="イベントの詳細や注意事項などを入力"
                      rows={3}
                    />
                    {errors.description && <p className="mt-1.5 text-red-600 text-sm">{errors.description.message}</p>}
                  </div>
                </div>
              </div>

              {/* 情報ボックス */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 text-primary shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                >
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <HiInformationCircle className="h-5 w-5" />
                    開始日・終了日／時間帯について
                  </div>
                  <span className={`transition-transform ${isInfoExpanded ? "rotate-180" : ""}`}>▼</span>
                </button>
                {isInfoExpanded && (
                  <div className="mt-3 border-blue-200 border-t pt-3 text-sm">
                    <p>
                      イツヒマでは、<strong>主催者側で候補日程を設定せずに</strong>日程調整します。
                      <br />
                      ここでは、参加者の日程を知りたい日付の範囲と時間帯の範囲を設定してください。
                      <br />
                      詳しくは、
                      <a
                        href={EXTERNAL_LINKS.GUIDE}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-medium text-primary underline hover:text-primary/80"
                      >
                        使い方ページ
                      </a>
                      をご覧ください。
                    </p>
                  </div>
                )}
              </div>

              {/* 日程の範囲 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-semibold text-base text-slate-900 sm:text-lg">日程の範囲</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div
                    className={project && project.guests.length > 0 ? "tooltip tooltip-top" : ""}
                    data-tip={
                      project && project.guests.length > 0
                        ? "すでに日程を登録したユーザーがいるため、開始日の編集はできません"
                        : ""
                    }
                  >
                    <label htmlFor="input-start" className="mb-2 block font-medium text-slate-700 text-sm">
                      開始日 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      {...register("startDate")}
                      id="input-start"
                      className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-2.5 sm:text-base ${errors.startDate ? "border-red-500" : "border-slate-300"} ${project && project.guests.length > 0 ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
                      onFocus={handleFieldFocus}
                      disabled={!!(project && project.guests.length > 0)}
                    />
                    {errors.startDate && <p className="mt-1.5 text-red-600 text-sm">{errors.startDate.message}</p>}
                  </div>
                  <div
                    className={project && project.guests.length > 0 ? "tooltip tooltip-top" : ""}
                    data-tip={
                      project && project.guests.length > 0
                        ? "すでに日程を登録したユーザーがいるため、終了日の編集はできません"
                        : ""
                    }
                  >
                    <label htmlFor="input-end" className="mb-2 block font-medium text-slate-700 text-sm">
                      終了日 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      {...register("endDate")}
                      id="input-end"
                      className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-2.5 sm:text-base ${errors.endDate ? "border-red-500" : "border-slate-300"} ${project && project.guests.length > 0 ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
                      onFocus={handleFieldFocus}
                      disabled={!!(project && project.guests.length > 0)}
                    />
                    {errors.endDate && <p className="mt-1.5 text-red-600 text-sm">{errors.endDate.message}</p>}
                  </div>
                </div>
              </div>

              {/* 時間帯 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-semibold text-base text-slate-900 sm:text-lg">時間帯</h2>
                <div
                  className={project && project.guests.length > 0 ? "tooltip tooltip-top w-full" : "w-full"}
                  data-tip={
                    project && project.guests.length > 0
                      ? "すでに日程を登録したユーザーがいるため、時間帯の編集はできません"
                      : ""
                  }
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex flex-1 items-center gap-1.5 sm:gap-2">
                      <select
                        className={`flex-1 rounded-lg border px-2 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-3 sm:py-2.5 sm:text-base ${errors.allowedRanges ? "border-red-500" : "border-slate-300"} ${project && project.guests.length > 0 ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
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
                      <span className="font-medium text-slate-600 text-sm sm:text-base">:</span>
                      <select
                        className={`flex-1 rounded-lg border px-2 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-3 sm:py-2.5 sm:text-base ${errors.allowedRanges ? "border-red-500" : "border-slate-300"} ${project && project.guests.length > 0 ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
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
                    <span className="font-medium text-slate-600 text-sm sm:text-base">〜</span>
                    <div className="flex flex-1 items-center gap-1.5 sm:gap-2">
                      <select
                        className={`flex-1 rounded-lg border px-2 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-3 sm:py-2.5 sm:text-base ${errors.allowedRanges ? "border-red-500" : "border-slate-300"} ${project && project.guests.length > 0 ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
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
                      <span className="font-medium text-slate-600 text-sm sm:text-base">:</span>
                      <select
                        className={`flex-1 rounded-lg border px-2 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-3 sm:py-2.5 sm:text-base ${errors.allowedRanges ? "border-red-500" : "border-slate-300"} ${project && project.guests.length > 0 ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
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
                  <p className="mt-2 text-red-600 text-sm">{errors.allowedRanges.message}</p>
                )}
              </div>

              {/* 参加形態 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setIsParticipationExpanded(!isParticipationExpanded)}
                >
                  <h2 className="font-semibold text-base text-slate-900 sm:text-lg">参加形態の設定 (任意)</h2>
                  <span
                    className={`text-slate-600 transition-transform ${isParticipationExpanded ? "rotate-180" : ""}`}
                  >
                    ▼
                  </span>
                </button>
                {isParticipationExpanded && (
                  <div className="mt-4 border-slate-200 border-t pt-4">
                    <p className="mb-4 text-slate-600 text-sm">
                      参加形態を設定すると、参加者は「対面」「オンライン」などの形態を選んで日程を登録できます。
                    </p>

                    <div className="space-y-3">
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
                          <div key={field.id} className="w-full">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <input type="hidden" {...register(`participationOptions.${index}.id`)} value={field.id} />
                              <div className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11">
                                <input
                                  type="color"
                                  {...register(`participationOptions.${index}.color`)}
                                  defaultValue={field.color}
                                  // カラーピッカーのスタイルはブラウザに依存した調整が必要
                                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-lg border-0 shadow-[0_0_0_2px_rgb(226_232_240),0_1px_2px_0_rgb(0_0_0/0.05)] [&::-moz-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0"
                                />
                              </div>
                              <input
                                type="text"
                                {...register(`participationOptions.${index}.label`)}
                                defaultValue={field.label}
                                placeholder="参加形態名（例：対面、オンライン）"
                                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-2.5 sm:text-base ${errors.participationOptions?.[index]?.label ? "border-red-500" : "border-slate-300"}`}
                                onBlur={() => {
                                  trigger(`participationOptions.${index}.label` as const);
                                }}
                              />
                              <div className={cannotDelete ? "tooltip tooltip-left" : ""} data-tip={tooltipMessage}>
                                <button
                                  type="button"
                                  onClick={() => removeParticipation(index)}
                                  className={`rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 sm:p-2.5 ${cannotDelete ? "cursor-not-allowed opacity-40" : ""}`}
                                  disabled={cannotDelete}
                                >
                                  <HiOutlineTrash size={18} className="sm:h-5 sm:w-5" />
                                </button>
                              </div>
                            </div>
                            {errors.participationOptions?.[index]?.label && (
                              <p className="mt-1.5 text-red-600 text-sm">
                                {errors.participationOptions[index]?.label?.message as string}
                              </p>
                            )}
                            {errors.participationOptions?.[index]?.color && (
                              <p className="mt-1.5 text-red-600 text-sm">
                                {errors.participationOptions[index]?.color?.message as string}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

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
                      className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 text-xs transition-all hover:border-slate-300 hover:bg-slate-50 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                    >
                      + 参加形態を追加
                    </button>
                  </div>
                )}
              </div>

              {/* イベントの削除 */}
              {project && (
                <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-sm">
                  <h2 className="mb-2 font-semibold text-base text-slate-900 sm:text-lg">イベントの削除</h2>
                  <p className="mb-4 text-slate-600 text-sm">この操作は取り消せません。慎重に行ってください。</p>
                  <button
                    type="button"
                    id="delete-button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white text-xs transition-all hover:bg-red-700 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
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
                          // TODO: トーストをグローバルにする
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
                    <HiOutlineTrash size={16} className="sm:h-5 sm:w-5" />
                    イベントを削除する
                  </button>
                </div>
              )}
            </form>

            {/* 固定フッター */}
            <div className="fixed right-0 bottom-0 left-0 z-10 border-slate-200 border-t bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:py-4">
              <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 sm:gap-4">
                {eventId ? (
                  <NavLink
                    to={`/e/${eventId}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 text-sm transition-all hover:border-slate-300 hover:bg-slate-50 sm:gap-2 sm:px-6 sm:py-2.5"
                  >
                    日程調整に戻る
                  </NavLink>
                ) : (
                  <NavLink
                    to="/home"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 text-sm transition-all hover:border-slate-300 hover:bg-slate-50 sm:gap-2 sm:px-6 sm:py-2.5"
                  >
                    ホームに戻る
                  </NavLink>
                )}
                <button
                  type="submit"
                  form="project-form"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-semibold text-sm text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-6 sm:py-2.5"
                  disabled={!isValid || !isDirty}
                >
                  イベントを{project ? "更新" : "作成"}する
                </button>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* 作成完了ダイアログ */}
      {dialogStatus !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <h3 className="mb-1.5 font-bold text-lg text-slate-900 sm:mb-2 sm:text-2xl">
              {dialogStatus.projectName}を作成しました
            </h3>
            <p className="mb-4 text-slate-600 text-xs sm:mb-6 sm:text-sm">URL をコピーして共有しましょう！</p>
            <div className="mb-4 flex gap-2 sm:mb-6">
              <input
                type="text"
                disabled
                className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 text-xs sm:px-4 sm:py-2.5 sm:text-sm"
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
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-primary bg-white px-3 py-2 font-semibold text-primary text-xs transition-all hover:bg-primary/5 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                disabled={copied}
              >
                {!copied ? (
                  <HiClipboardCopy size={16} className="sm:h-5 sm:w-5" />
                ) : (
                  <HiClipboardCheck size={16} className="sm:h-5 sm:w-5" />
                )}{" "}
                <span className="hidden sm:inline">コピー</span>
              </button>
            </div>
            <div className="flex justify-end">
              <NavLink
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-semibold text-sm text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-xl sm:gap-2 sm:px-6 sm:py-2.5"
                to={`/e/${dialogStatus.projectId}`}
              >
                イベントへ
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* トースト */}
      {toast && (
        <div className="fixed top-20 right-4 z-50">
          {toast.variant === "success" ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
              <HiOutlineCheckCircle size={24} className="shrink-0 text-emerald-600" />
              <span className="font-medium text-emerald-900 text-sm">{toast.message}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg">
              <HiOutlineExclamationCircle size={24} className="shrink-0 text-red-600" />
              <span className="font-medium text-red-900 text-sm">{toast.message}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
