import { NavLink, useNavigate, useParams } from "react-router";
import { Calendar } from "../../../components/Calendar";
import { Me, meResSchema, Project, projectResSchema } from "../../../../../common/schema";
import { useData } from "../../../hooks";
import { useCallback, useState } from "react";

export default function SubmissionPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const {
    data: project,
    loading: projectLoading,
    error: projectError,
  } = useData<Project>(`http://localhost:3000/event/${eventId}`, projectResSchema);

  const {
    data: me,
    loading: meLoading,
    error: meError,
  } = useData<Me>("http://localhost:3000/user/me", meResSchema);

  const loading = projectLoading || meLoading;
  const error = (projectError ?? "") + (meError ?? "");

  const [guestName, setGuestName] = useState("");

  const myGuestId = me?.guests.find((g) => g.eventId === eventId)?.id;

  // const [isHost, setIsHost] = useState(false);
  // const [alreadyGuest, setAlreadyGuest] = useState(false);

  // const navigate = useNavigate();

  // -------------------- Slot 追加処理 --------------------
  // const handleAddSlot = (
  //   date: string,
  //   range: { id: string; startTime: string; endTime: string },
  //   start: string,
  //   end: string,
  // ) => {
  //   // ✅ date + 時刻から datetime 生成
  //   const selectedStart = new Date(`${date}T${start}:00`);
  //   const selectedEnd = new Date(`${date}T${end}:00`);

  //   // ✅ 大枠の範囲から時刻部分だけ抜き出す (dateと無関係な時刻)
  //   const rangeStartTime = new Date(range.startTime);
  //   const rangeEndTime = new Date(range.endTime);

  //   // ✅ date部分を揃えて比較 (重要!!)
  //   const rangeStart = new Date(`${date}T${rangeStartTime.toISOString().split("T")[1]}`);
  //   const rangeEnd = new Date(`${date}T${rangeEndTime.toISOString().split("T")[1]}`);

  //   // ✅ 範囲チェック
  //   if (selectedStart < rangeStart || selectedEnd > rangeEnd || selectedStart >= selectedEnd) {
  //     alert("指定した時間が範囲外、または開始が終了より後になっています");
  //     return;
  //   }

  //   // ✅ SlotSchema形式に準拠したSlot作成
  //   const newSlot = {
  //     start: selectedStart.toISOString(),
  //     end: selectedEnd.toISOString(),
  //     eventId: eventId!, // eventId確定しているなら
  //   };

  //   console.log("新規Slot:", newSlot); // 確認用

  //   setSelectedSlots((prev) => [...prev, newSlot]);
  // };

  // -------------------- Guest 登録処理 --------------------
  // const handleRegisterGuest = async () => {
  //   setLoading(true);
  //   if (!guestName.trim()) {
  //     alert("名前を入力してください");
  //     return;
  //   }

  //   // Slotバリデーション
  //   // for (const slot of selectedSlots) {
  //   //   try {
  //   //     SlotSchema.parse(slot);
  //   //   } catch (err: any) {
  //   //     alert(`Slotの形式が不正です: ${err.message}`);
  //   //     return;
  //   //   }
  //   // }

  //   // Guestオブジェクト
  //   const guest = {
  //     name: guestName,
  //     slots: selectedSlots,
  //     eventId: eventId,
  //   };
  //   // console.log("送信情報", guest);

  //   try {
  //     const parseData = GuestSchema.parse(guest);
  //     if (alreadyGuest) {
  //       const res = await fetch(`http://localhost:3000/event/${eventId}/submit`, {
  //         method: "PUT",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(parseData),
  //         credentials: "include",
  //       });
  //       if (!res.ok) throw new Error("ゲスト登録に失敗しました");
  //       console.log(await res.json());
  //     } else {
  //       const res = await fetch(`http://localhost:3000/event/${eventId}/submit`, {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(parseData),
  //         credentials: "include",
  //       });
  //       if (!res.ok) throw new Error("ゲスト登録に失敗しました");
  //       console.log(await res.json());
  //     }
  //     // setSelectedSlots([]);
  //     setGuestName("");
  //     navigate(`./done`);
  //     setLoading(false);
  //   } catch (err: any) {
  //     alert(`エラー: ${err.message}`);
  //     setLoading(false);
  //   }
  // };

  // -------------------- 日付一覧生成 --------------------
  // const getDatesInRange = (startDate: string, endDate: string) => {
  //   const start = new Date(startDate);
  //   const end = new Date(endDate);
  //   const dates = [];
  //   while (start <= end) {
  //     dates.push(new Date(start).toISOString().split("T")[0]);
  //     start.setDate(start.getDate() + 1);
  //   }
  //   return dates;
  // };

  const postAvailability = useCallback(
    async (slots: { start: Date; end: Date }[], myGuestId: string) => {
      const payload = {
        name: guestName,
        eventId,
        slots,
      };
      try {
        // submitReqSchema.parse(payload) TODO:
      } catch (err) {
        console.error(err);
        return;
      }
      if (!myGuestId) {
      await fetch(`http://localhost:3000/event/${eventId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
    } else {
      await fetch(`http://localhost:3000/event/${eventId}/submit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
    }
      
    },
    [guestName, eventId],
  );

  // -------------------- UI --------------------
  if (loading) return <p>読み込み中...</p>;
  if (error) return <p>エラー: {error}</p>;
  if (!project) return <p>イベントが存在しません。</p>;
  if (!me) return <p>ユーザー情報が取得できませんでした。</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">イベント詳細</h1>
      <p>イベント名: {project.name}</p>
      {/*  FIXME: guestName の更新ごとに Calendar が再描画され、コストが大きい*/}
      <Calendar project={project} onSubmit={postAvailability} myGuestId={myGuestId ?? ""}/>
      {/* {isHost && (
        <NavLink to={`/${eventId}/edit`} className="block hover:underline">
          イベントを編集する
        </NavLink>
      )} */}

      {/* ----------- 大枠 (Range) ----------- */}
      {/* TODO: カレンダーにグレー枠で表示など */}
      {/* <h2 className="text-lg font-semibold mt-4">時間帯の大枠 (Range)</h2>
      <ul>
        {project.range.map((r) => (
          <li key={r.id} className="border p-2 my-2">
            {new Date(r.startTime).toLocaleString()} ～ {new Date(r.endTime).toLocaleString()}
          </li>
        ))}
      </ul> */}

      {/* ----------- ゲスト (Guest) ----------- */}
      {/* TODO: カレンダーに人数を表示など */}
      {/* <h2 className="text-lg font-semibold mt-4">ゲスト</h2>
      {project.guests?.length ? (
        <ul>
          {project.guests.map((guest) => (
            <li key={guest.id} className="border p-2 my-2">
              {guest.name} (ID: {guest.id})
              {guest.slots && guest.slots.length > 0 && (
                <ul className="pl-4 mt-1">
                  {guest.slots!.map((slot: Slot) => (
                    <li key={slot.id}>
                      {new Date(slot.start).toLocaleString()} ～{" "}
                      {new Date(slot.end).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>ゲストはいません</p>
      )} */}

      {/* ----------- ゲスト名入力 ----------- */}
      <h2 className="text-lg font-semibold mt-6">参加者情報</h2>
      <input
        type="text"
        placeholder="あなたの名前"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        className="input input-bordered w-full max-w-xs my-2"
      />
    </div>
  );
}
