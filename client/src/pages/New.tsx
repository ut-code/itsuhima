import { useState } from "react";
import { useNavigate } from "react-router";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectReqSchema } from "../../../common/schema";
import { z } from "zod";
import Header from "../components/Header";
import { API_ENDPOINT } from "../utils";

// スキーマに基づく型定義
type ProjectFormValues = z.infer<typeof projectReqSchema>;

export default function NewPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  // フォーム管理
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectReqSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
      allowedRanges: [{ startTime: "", endTime: "" }],
    },
  });

  const { fields, replace } = useFieldArray({
    control,
    name: "allowedRanges",
  });

  // 送信処理
  const onSubmit = async (data: ProjectFormValues) => {
    setLoading(true);

    // 日付をISO形式に変換
    const startDateTime = new Date(data.startDate + "T00:00:00.000Z").toISOString();
    const endDateTime = new Date(data.endDate + "T23:59:59.999Z").toISOString();

    // range もISO形式に変換
    const rangeWithDateTime = data.allowedRanges.map((range) => ({
      startTime: new Date(`${data.startDate}T${range.startTime}:00`).toISOString(),
      endTime: new Date(`${data.startDate}T${range.endTime}:00`).toISOString(),
    }));

    const eventData = {
      name: data.name,
      startDate: startDateTime,
      endDate: endDateTime,
      allowedRanges: rangeWithDateTime,
    } satisfies z.infer<typeof projectReqSchema>;

    console.log("送信データ:", eventData);

    const res = await fetch(`${API_ENDPOINT}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
      credentials: "include",
    });

    const eventId = await res.json();
    console.log("受信データ", eventId);

    setLoading(false);
    if (res.ok) {
      navigate(`/${eventId}`);
    } else {
      alert("送信に失敗しました");
    }
  };

  return (
    <>
      <Header />
      <div className="container p-4 mx-auto">
        {loading && (
          <div className="fixed inset-0 bg-opacity-50 flex justify-center items-center z-50">
            <span className="loading loading-spinner loading-lg text-blue"></span>
          </div>
        )}
        <h1 className="text-2xl mb-2">イベント作成</h1>
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
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm text-gray-400">開始日</label>
              <input type="date" {...register("startDate")} className="input w-full text-base" />
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
                  {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")).map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
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
                  {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")).map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
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

          <div className="p-4 w-full fixed bottom-0 left-0 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={!isValid}>
              イベントを作成する
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
