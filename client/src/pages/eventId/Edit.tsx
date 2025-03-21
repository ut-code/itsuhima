import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Me, meResSchema, Project, projectResSchema } from "../../../../common/schema";
import { useData } from "../../hooks";
import Header from "../../components/Header";
import { API_ENDPOINT } from "../../utils";

export default function EditPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [name, setName] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(""); // ISO 文字列
  const [endDate, setEndDate] = useState<string>(""); // ISO 文字列
  const [ranges, setRanges] = useState<{ startTime: string; endTime: string }[]>([]); // range 配列
  const navigate = useNavigate(); // ページ遷移

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

  // range 追加処理
  const handleAddRange = () => {
    setRanges([...ranges, { startTime: "", endTime: "" }]);
  };

  // range 更新処理
  const handleRangeChange = (index: number, field: "startTime" | "endTime", value: string) => {
    const newRanges = [...ranges];
    newRanges[index][field] = value;
    setRanges(newRanges);
  };

  // 送信処理
  // 送信処理
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let eventData;
    if (project && project.guests) {
      // すでにデータを登録したユーザーがいる場合、名前のみ編集可能
      eventData = { name };
    } else {
      // 通常の編集
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
        range: rangeWithDateTime,
      };
    }

    console.log("送信データ:", eventData);

    const res = await fetch(`${API_ENDPOINT}/projects/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
      credentials: "include",
    });

    const data = await res.json();
    console.log("受信データ", data.event);

    if (res.ok) {
      if (project) {
        alert(project.guests ? "イベント名が更新されました。" : "イベント情報が更新されました。");
      }
      navigate(`/${eventId}`);
    } else {
      alert(res.status === 403 ? "認証に失敗しました。" : "更新に失敗しました。");
    }
  };

  if (!isHost) navigate(`/${eventId}/submit`);

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

          {!project.guests ? (
            <>
              {" "}
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
                <label>範囲 (range)</label>
                {ranges.map((range, index) => (
                  <div key={index} className="space-y-2 p-2 border rounded mb-2">
                    <div>
                      <label>開始時刻</label>
                      <input
                        type="time"
                        value={range.startTime}
                        onChange={(e) =>
                          handleRangeChange(index, "startTime", `${e.target.value}:00`)
                        }
                        className="input input-bordered w-full"
                        required
                      />
                    </div>
                    <div>
                      <label>終了時刻</label>
                      <input
                        type="time"
                        value={range.endTime}
                        onChange={(e) =>
                          handleRangeChange(index, "endTime", `${e.target.value}:00`)
                        }
                        className="input input-bordered w-full"
                        required
                      />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={handleAddRange} className="btn btn-secondary">
                  範囲を追加
                </button>
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
