import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { hc } from "hono/client";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import {
  HiClipboardCheck,
  HiClipboardCopy,
  HiInformationCircle,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
} from "react-icons/hi";
import { NavLink, useNavigate, useParams } from "react-router";
import type { z } from "zod";
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
  useEffect(() => {
    const fetchProject = async () => {
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
    };
    fetchProject();
  }, [eventId]);

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
      startDate: eventId ? "" : dayjs().format("YYYY-MM-DD"),
      endDate: eventId ? "" : dayjs().add(6, "day").format("YYYY-MM-DD"),
      allowedRanges: [{ startTime: "00:00", endTime: "23:45" }],
    },
  });

  const handleFieldFocus = () => {
    trigger("name");
  };

  const { fields, replace } = useFieldArray({
    control,
    name: "allowedRanges",
  });

  useEffect(() => {
    if (!eventId) return;
    if (!project) return;
    reset({
      name: project.name,
      startDate: dayjs(project.startDate).format("YYYY-MM-DD"),
      endDate: dayjs(project.endDate).format("YYYY-MM-DD"),
      allowedRanges: [
        {
          startTime: dayjs(project.allowedRanges[0].startTime).format("HH:mm"),
          endTime: dayjs(project.allowedRanges[0].endTime).format("HH:mm"),
        },
      ],
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
      startDate: startDateTime,
      endDate: endDateTime,
      allowedRanges: rangeWithDateTime ?? [],
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
        // TODO: 更新したデータで再レンダリング
        setToast({
          message: "更新しました。",
          variant: "success",
        });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({
          message: res.status === 403 ? "権限がありません。" : "更新に失敗しました。",
          variant: "error",
        });
        setTimeout(() => setToast(null), 3000);
      }
    }
  };

  const isHost = project?.isHost;

  useEffect(() => {
    if (!loading && project && !isHost) {
      if (eventId) {
        navigate(`/${eventId}`);
      } else {
        navigate("/");
      }
    }
  }, [loading, project, isHost, eventId, navigate]);

  return (
    <>
      <div className="h-full w-full flex flex-col">
        <Header />
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <span className="loading loading-dots loading-md text-gray-400" />
          </div>
        ) : eventId !== undefined && !project ? (
          <div className="flex flex-col justify-center items-center py-4 gap-4">
            <p className="text-xl text-gray-600">イベントが見つかりませんでした。</p>
            <NavLink to={"/"} className="link">
              ホームに戻る
            </NavLink>
          </div>
        ) : (
          <div className="container p-4 mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {project ? `${project.name} の編集` : "イベントの作成"}
            </h1>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400" htmlFor="input-name">
                  イベント名
                </label>
                <input
                  {...register("name")}
                  id="input-name"
                  className={`input w-full text-base ${errors.name ? "input-error border-red-500" : ""}`}
                  placeholder="イベント名"
                  onBlur={() => trigger("name")}
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>
              {!project || (project && project.guests.length === 0) ? (
                <>
                  <div className="collapse collapse-arrow bg-blue-50 border border-blue-200 mb-4">
                    <input
                      type="checkbox"
                      checked={isInfoExpanded}
                      onChange={(e) => setIsInfoExpanded(e.target.checked)}
                    />
                    <div className="collapse-title text-sm font-medium text-primary flex items-center gap-2">
                      <HiInformationCircle className="w-5 h-5" />
                      開始日・終了日／時間帯について
                    </div>
                    <div className="collapse-content text-sm text-primary">
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
                    <div className="flex-1">
                      <label htmlFor="input-start" className="text-sm text-gray-400">
                        開始日
                      </label>
                      <input
                        type="date"
                        {...register("startDate")}
                        id="input-start"
                        className={`input w-full text-base ${errors.startDate ? "input-error border-red-500" : ""}`}
                        onFocus={handleFieldFocus}
                      />
                      {errors.startDate && <p className="text-red-500 text-sm mt-1">{errors.startDate.message}</p>}
                    </div>
                    <div className="flex-1">
                      <label htmlFor="input-end" className="text-sm text-gray-400">
                        終了日
                      </label>
                      <input
                        type="date"
                        {...register("endDate")}
                        id="input-end"
                        className={`input w-full text-base ${errors.endDate ? "input-error border-red-500" : ""}`}
                        onFocus={handleFieldFocus}
                      />
                      {errors.endDate && <p className="text-red-500 text-sm mt-1">{errors.endDate.message}</p>}
                    </div>
                  </div>
                  <fieldset>
                    <legend className="text-sm text-gray-400">時間帯</legend>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 flex gap-1">
                        <select
                          className={`input flex-1 text-base ${errors.allowedRanges ? "input-error border-red-500" : ""}`}
                          value={fields[0].startTime.split(":")[0]}
                          onChange={(e) => {
                            replace([
                              {
                                startTime: `${e.target.value}:${fields[0].startTime.split(":")[1]}`,
                                endTime: fields[0].endTime,
                              },
                            ]);
                          }}
                          onFocus={handleFieldFocus}
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
                          className={`input flex-1 text-base ${errors.allowedRanges ? "input-error border-red-500" : ""}`}
                          value={fields[0].startTime.split(":")[1]}
                          onChange={(e) => {
                            replace([
                              {
                                startTime: `${fields[0].startTime.split(":")[0]}:${e.target.value}`,
                                endTime: fields[0].endTime,
                              },
                            ]);
                          }}
                          onFocus={handleFieldFocus}
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
                      <div className="flex-1 flex gap-1">
                        <select
                          className={`input flex-1 text-base ${errors.allowedRanges ? "input-error border-red-500" : ""}`}
                          value={fields[0].endTime.split(":")[0]}
                          onChange={(e) => {
                            replace([
                              {
                                startTime: fields[0].startTime,
                                endTime: `${e.target.value}:${fields[0].endTime.split(":")[1]}`,
                              },
                            ]);
                          }}
                          onFocus={handleFieldFocus}
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
                          className={`input flex-1 text-base ${errors.allowedRanges ? "input-error border-red-500" : ""}`}
                          value={fields[0].endTime.split(":")[1]}
                          onChange={(e) => {
                            replace([
                              {
                                startTime: fields[0].startTime,
                                endTime: `${fields[0].endTime.split(":")[0]}:${e.target.value}`,
                              },
                            ]);
                          }}
                          onFocus={handleFieldFocus}
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
                    {errors.allowedRanges && typeof errors.allowedRanges?.message === "string" && (
                      <p className="text-red-500 text-sm mt-1">{errors.allowedRanges.message}</p>
                    )}
                  </fieldset>
                </>
              ) : (
                <p>すでにデータを登録したユーザーがいるため、日時の編集はできません。</p>
              )}
              {project && (
                <fieldset>
                  <legend className="text-sm text-gray-400">イベントの削除</legend>
                  <div className="flex justify-end py-2">
                    <button
                      id="delete-button"
                      className="btn bg-red-700 text-white"
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
                      イベントを削除する
                    </button>
                  </div>
                </fieldset>
              )}
              <div className="p-4 w-full fixed bottom-0 left-0 flex justify-between">
                <NavLink to={"/home"} className="btn btn-outline btn-primary">
                  ホームに戻る
                </NavLink>
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
                value={`${FRONTEND_ORIGIN}/${dialogStatus.projectId}`}
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(`${FRONTEND_ORIGIN}/${dialogStatus.projectId}`);
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
              <NavLink className="btn btn-primary" to={`/${dialogStatus.projectId}`}>
                イベントへ
              </NavLink>
            </div>
          </div>
        </div>
      )}
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
