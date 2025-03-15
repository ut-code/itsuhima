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

  const { fields, append } = useFieldArray({
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
        <h1>イベント作成</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label>イベント名</label>
            <input
              {...register("name")}
              className="input input-bordered w-full"
              placeholder="イベント名"
            />
            {errors.name && <p className="text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label>開始日</label>
            <input type="date" {...register("startDate")} className="input input-bordered w-full" />
            {errors.startDate && <p className="text-red-500">{errors.startDate.message}</p>}
          </div>

          <div>
            <label>終了日</label>
            <input type="date" {...register("endDate")} className="input input-bordered w-full" />
            {errors.endDate && <p className="text-red-500">{errors.endDate.message}</p>}
          </div>

          <div>
            <label>範囲 (range)</label>
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-2 p-2 border rounded mb-2">
                <div>
                  <label>開始時刻</label>
                  <input
                    type="time"
                    {...register(`allowedRanges.${index}.startTime`)}
                    className="input input-bordered w-full"
                  />
                  {errors.allowedRanges?.[index]?.startTime && (
                    <p className="text-red-500">{errors.allowedRanges[index].startTime?.message}</p>
                  )}
                </div>
                <div>
                  <label>終了時刻</label>
                  <input
                    type="time"
                    {...register(`allowedRanges.${index}.endTime`)}
                    className="input input-bordered w-full"
                  />
                  {errors.allowedRanges?.[index]?.endTime && (
                    <p className="text-red-500">{errors.allowedRanges[index].endTime?.message}</p> //TODO: なぜかエラーが表示されないが
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ startTime: "", endTime: "" })}
              className="btn btn-secondary"
            >
              範囲を追加
            </button>
            {errors.allowedRanges && <p className="text-red-500">{errors.allowedRanges.message}</p>}
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={!isValid}>
            送信
          </button>
        </form>
      </div>
    </>
  );
}
