import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  editReqSchema,
  ProjectRes,
  projectReqSchema,
  projectResSchema,
} from "../../../common/schema";
import { z } from "zod";
import Header from "../components/Header";
import { API_ENDPOINT, FRONTEND_ORIGIN } from "../utils";
import { useData } from "../hooks";
import dayjs from "dayjs";
import {
  HiClipboardCheck,
  HiClipboardCopy,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
} from "react-icons/hi";

export default function ProjectPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const formSchema = eventId ? editReqSchema : projectReqSchema;
  type FormSchemaType = z.infer<typeof formSchema>;

  const { data: project, loading: projectLoading } = useData<ProjectRes>(
    eventId ? `${API_ENDPOINT}/projects/${eventId}` : null,
    projectResSchema,
  );

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

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
      allowedRanges: [{ startTime: "00:00", endTime: "23:45" }],
    },
  });

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
    const startDateTime = new Date(data.startDate + "T00:00:00.000Z").toISOString();
    const endDateTime = new Date(data.endDate + "T23:59:59.999Z").toISOString();

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
      const res = await fetch(`${API_ENDPOINT}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
        credentials: "include",
      });

      const { id: projectId, name: projectName } = await res.json(); // TODO:

      setSubmitLoading(false);
      if (res.ok) {
        setDialogStatus({
          projectId: projectId,
          projectName: projectName,
        });
      } else {
        setToast({
          message: "送信に失敗しました",
          variant: "error",
        });
        setTimeout(() => setToast(null), 3000);
      }
    } else {
      const res = await fetch(`${API_ENDPOINT}/projects/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
        credentials: "include",
      });

      setSubmitLoading(false);
      if (res.ok) {
        setToast({
          message: "更新しました。",
          variant: "success",
        });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({
          message: res.status === 403 ? "認証に失敗しました。" : "更新に失敗しました。",
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
            <span className="loading loading-dots loading-md text-gray-400"></span>
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
            <h1 className="text-2xl mb-2">
              {project ? `${project.name} の編集` : "イベントの作成"}
            </h1>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">イベント名</label>
                <input
                  {...register("name")}
                  className="input w-full text-base"
                  placeholder="イベント名"
                />
                {errors.name && <p className="text-red-500">{errors.name.message}</p>}
              </div>
              {!project || (project && project.guests.length === 0) ? (
                <>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-sm text-gray-400">開始日</label>
                      <input
                        type="date"
                        {...register("startDate")}
                        className="input w-full text-base"
                      />
                      {errors.startDate && (
                        <p className="text-red-500">{errors.startDate.message}</p>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="text-sm text-gray-400">終了日</label>
                      <input
                        type="date"
                        {...register("endDate")}
                        className="input w-full text-base"
                      />
                      {errors.endDate && <p className="text-red-500">{errors.endDate.message}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">時間帯</label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 flex gap-1">
                        <select
                          className="input flex-1 text-base"
                          value={fields[0].startTime.split(":")[0]}
                          onChange={(e) => {
                            replace([
                              {
                                startTime: e.target.value + ":" + fields[0].startTime.split(":")[1],
                                endTime: fields[0].endTime,
                              },
                            ]);
                          }}
                        >
                          <option value="" disabled>
                            時
                          </option>
                          {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")).map(
                            (h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ),
                          )}
                        </select>
                        <select
                          className="input flex-1 text-base"
                          value={fields[0].startTime.split(":")[1]}
                          onChange={(e) => {
                            replace([
                              {
                                startTime: fields[0].startTime.split(":")[0] + ":" + e.target.value,
                                endTime: fields[0].endTime,
                              },
                            ]);
                          }}
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
                          className="input flex-1 text-base"
                          value={fields[0].endTime.split(":")[0]}
                          onChange={(e) => {
                            replace([
                              {
                                startTime: fields[0].startTime,
                                endTime: e.target.value + ":" + fields[0].endTime.split(":")[1],
                              },
                            ]);
                          }}
                        >
                          <option value="" disabled>
                            時
                          </option>
                          {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")).map(
                            (h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ),
                          )}
                        </select>
                        <select
                          className="input flex-1 text-base"
                          value={fields[0].endTime.split(":")[1]}
                          onChange={(e) => {
                            replace([
                              {
                                startTime: fields[0].startTime,
                                endTime: fields[0].endTime.split(":")[0] + ":" + e.target.value,
                              },
                            ]);
                          }}
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
                      <p className="text-red-500">{errors.allowedRanges.message}</p>
                    )}
                  </div>
                </>
              ) : (
                <p>すでにデータを登録したユーザーがいるため、日時の編集はできません。</p>
              )}
              {project && (
                <div>
                  <label className="text-sm text-gray-400">イベントの削除</label>
                  <div className="flex justify-end py-2">
                    <button
                      className="btn bg-red-700 text-white"
                      onClick={async () => {
                        if (confirm("本当にこのイベントを削除しますか？")) {
                          try {
                            const response = await fetch(`${API_ENDPOINT}/projects/${project.id}`, {
                              method: "DELETE",
                            });
                            if (!response.ok) {
                              throw new Error("削除に失敗しました。");
                            }
                            navigate("/");
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
                </div>
              )}
              <div className="p-4 w-full fixed bottom-0 left-0 flex justify-end">
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
                  await navigator.clipboard.writeText(
                    `${FRONTEND_ORIGIN}/${dialogStatus.projectId}`,
                  );
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
