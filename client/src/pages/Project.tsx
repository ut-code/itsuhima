import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  editReqSchema,
  Me,
  meResSchema,
  Project,
  projectReqSchema,
  projectResSchema,
} from "../../../common/schema";
import { z } from "zod";
import Header from "../components/Header";
import { API_ENDPOINT } from "../utils";
import { useData } from "../hooks";
import dayjs from "dayjs";

export default function ProjectPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const formSchema = eventId ? editReqSchema : projectReqSchema;
  type FormSchemaType = z.infer<typeof formSchema>;

  const { data: project, loading: projectLoading } = useData<Project>(
    eventId ? `${API_ENDPOINT}/projects/${eventId}` : null,
    projectResSchema,
  );
  const { data: me, loading: meLoading } = useData<Me>(`${API_ENDPOINT}/users/me`, meResSchema);

  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const loading = projectLoading || meLoading || submitLoading;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isValid },
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

      const eventId = await res.json();

      setSubmitLoading(false);
      if (res.ok) {
        navigate(`/${eventId}`);
      } else {
        alert("送信に失敗しました");
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
        navigate(`/${eventId}`);
      } else {
        alert(res.status === 403 ? "認証に失敗しました。" : "更新に失敗しました。");
      }
    }
  };

  const isHost = me?.hosts.some((h) => h.projectId === eventId);

  useEffect(() => {
    if (!loading && me && project && !isHost) {
      if (eventId) {
        navigate(`/${eventId}/submit`);
      } else {
        navigate("/");
      }
    }
  }, [loading, me, project, isHost, eventId, navigate]);

  return (
    <>
      <Header />
      <div className="container p-4 mx-auto">
        {loading && (
          <div className="fixed inset-0 flex bg-white justify-center items-center z-50">
            <span className="loading loading-dots loading-lg text-gray-400"></span>
          </div>
        )}
        <h1 className="text-2xl mb-2">{project ? `${project.name} の編集` : "イベントの作成"}</h1>
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
                  {errors.startDate && <p className="text-red-500">{errors.startDate.message}</p>}
                </div>
                <div className="flex-1">
                  <label className="text-sm text-gray-400">終了日</label>
                  <input type="date" {...register("endDate")} className="input w-full text-base" />
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
                      <option value="">時</option>
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
                      <option value="">分</option>
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
                      <option value="">時</option>
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
                      <option value="">分</option>
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

          <div className="p-4 w-full fixed bottom-0 left-0 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={!isValid}>
              イベントを{project ? "更新" : "作成"}する
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
