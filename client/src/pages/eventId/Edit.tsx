import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Me, meResSchema, Project, projectResSchema } from "../../../../common/schema";
import { useData } from "../../hooks";
import Header from "../../components/Header";
import { API_ENDPOINT } from "../../utils";
import { TimeRange } from "../../components/TimeRange";

export default function EditPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [name, setName] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [ranges, setRanges] = useState<{ startTime: string; endTime: string }[]>([]);
  const navigate = useNavigate();

  const {
    data: project,
    loading: projectLoading,
    error: projectError,
  } = useData<Project>(`${API_ENDPOINT}/projects/${eventId}`, projectResSchema);

  const {
    data: me,
    loading: meLoading,
    error: meError,
  } = useData<Me>(`${API_ENDPOINT}/users/me`, meResSchema);

  const isHost = me?.hosts.some((h) => h.projectId === eventId);

  const loading = projectLoading || meLoading;
  const error = (projectError ?? "") + (meError ?? "");

  const handleReplaceRange = (range: { startTime: string; endTime: string }) => {
    setRanges([range]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let eventData;
    if (project && project.guests) {
      eventData = { name };
    } else {
      if (!startDate || !endDate || !ranges.length) {
        alert("開始日と終了日を入力してください");
        return;
      }

      const startDateTime = new Date(startDate + "T00:00:00.000Z").toISOString();
      const endDateTime = new Date(endDate + "T00:00:00.000Z").toISOString();

      const rangeWithDateTime = ranges.map((range) => ({
        startTime: new Date(`${startDate}T${range.startTime}`).toISOString(),
        endTime: new Date(`${startDate}T${range.endTime}`).toISOString(),
      }));

      eventData = {
        name,
        startDate: startDateTime,
        endDate: endDateTime,
        allowedRanges: rangeWithDateTime,
      };
    }

    const res = await fetch(`${API_ENDPOINT}/projects/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
      credentials: "include",
    });

    const data = await res.json();
    console.log(data.event);

    if (res.ok) {
      if (project) {
        alert(project.guests ? "イベント名が更新されました。" : "イベント情報が更新されました。");
      }
      navigate(`/${eventId}`);
    } else {
      alert(res.status === 403 ? "認証に失敗しました。" : "更新に失敗しました。");
    }
  };

  useEffect(() => {
    if (!loading && me && project && !isHost) {
      navigate(`/${eventId}/submit`);
    }
  }, [loading, me, project, isHost, eventId, navigate]);

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      if (project.startDate) setStartDate(new Date(project.startDate).toISOString().slice(0, 10));
      if (project.endDate) setEndDate(new Date(project.endDate).toISOString().slice(0, 10));
      if (project.allowedRanges && project.allowedRanges.length > 0) {
        const ranges = project.allowedRanges.map((range) => ({
          startTime: new Date(range.startTime).toTimeString().slice(0, 5),
          endTime: new Date(range.endTime).toTimeString().slice(0, 5),
        }));
        setRanges(ranges);
      }
    }
  }, [project]);
  if (loading) return <p>読み込み中...</p>;
  if (error) return <p>エラー: {error}</p>;
  if (!project) return <p>イベントが存在しません。</p>;
  if (!me) return <p>ユーザー情報が取得できませんでした。</p>;

  return (
    <>
      <Header />
      <div className="container p-4 mx-auto">
        {projectLoading && (
          <div className="fixed inset-0 bg-opacity-50 flex justify-center items-center z-50">
            <span className="loading loading-spinner loading-lg text-blue"></span>
          </div>
        )}
        <h1>イベント編集</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>イベント名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered w-full"
              required
              placeholder="イベント名"
            />
          </div>

          {!project.guests || project.guests.length === 0 ? (
            <>
              <div>
                <label>開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input input-bordered w-full"
                  required
                />
              </div>

              <div>
                <label>終了日</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input input-bordered w-full"
                  required
                />
              </div>

              <div>
                <label>範囲 (TimeRange)</label>
                <TimeRange onAddRange={handleReplaceRange} initialRanges={ranges} />

                {ranges.map((range, index) => (
                  <div key={index} className="flex items-center gap-2 border rounded p-2 my-2">
                    <div className="flex-1">
                      <span className="font-semibold">開始:</span> {range.startTime}
                      <span className="ml-4 font-semibold">終了:</span> {range.endTime}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p>すでにデータを登録したユーザーがいるため、日時の編集はできません。</p>
          )}

          <button type="submit" className="btn btn-primary w-full">
            送信
          </button>
        </form>
      </div>
    </>
  );
}
