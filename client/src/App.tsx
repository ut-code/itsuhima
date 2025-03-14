import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { GuestSchema, HostSchema } from "../../common/schema";
import { z } from "zod";

type Host = z.infer<typeof HostSchema>;
type Guest = z.infer<typeof GuestSchema>;
// type Event = z.infer<typeof EventSchema>;
// ---------- App ----------
export default function App() {
  const [userData, setUserData] = useState<{ hosts: Host[]; guests: Guest[] } | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // 読み込み中判定

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`http://localhost:3000/user`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          console.log("ユーザーデータ", data);

          if (data && (data.hosts.length > 0 || data.guests.length > 0)) {
            setUserData(data); // データがあればセット
          } else {
            setUserData(null); // 空データならnull
          }
        } else {
          setUserData(null);
        }
      } catch (error) {
        console.error("ユーザー取得エラー:", error);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // 読み込み中表示
  if (loading) return <p>読み込み中...</p>;

  // データがあれば Preview、なければ Landing
  return userData ? <Preview hosts={userData.hosts} guests={userData.guests} /> : <Landing />;
}

// ---------- Preview ----------
function Preview({ hosts, guests }: { hosts: Host[]; guests: Guest[] }) {
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-4xl mb-4">トップページ</h1>
      <NavLink to="./new" end className="btn btn-primary">
        イベントを作成する。
      </NavLink>
      <h2 className="text-2xl font-bold">あなたがホストのイベント一覧</h2>
      {hosts.length > 0 ? (
        <ul className="list-disc pl-5 space-y-2">
          {hosts.map((host) => (
            <li key={host.id} className="border p-2 rounded">
              <NavLink to={`/${host.event.id}/submit`} className="block hover:underline">
                <div>イベント名: {host.event.name}</div>
                <div>
                  日付: {formatDate(host.event.startDate)} ～ {formatDate(host.event.endDate)}
                </div>
                <div>イベントID: {host.event.id}</div>
              </NavLink>
            </li>
          ))}
        </ul>
      ) : (
        <p>ホストしているイベントはありません。</p>
      )}

      <h2 className="text-2xl font-bold">あなたがゲストのイベント一覧</h2>
      {guests.length > 0 ? (
        <ul className="list-disc pl-5 space-y-2">
          {guests.map((guest) => (
            <li key={guest.id} className="border p-2 rounded">
              <NavLink to={`/${guest.event.id}/submit`} className="block hover:underline">
                <div>イベント名: {guest.event.name}</div>
                <div>
                  日付: {formatDate(guest.event.startDate)} ～ {formatDate(guest.event.endDate)}
                </div>
                <div>あなたの名前: {guest.name}</div>
                <div>イベントID: {guest.event.id}</div>
              </NavLink>
            </li>
          ))}
        </ul>
      ) : (
        <p>参加しているイベントはありません。</p>
      )}
    </div>
  );
}

// ---------- Landing ----------
function Landing() {
  return (
    <div className="p-4">
      <h1 className="text-4xl mb-4">トップページ</h1>
      <NavLink to="./new" end className="btn btn-primary">
        イベントを作成する。
      </NavLink>
      <div className="mt-4">ランディングページ</div>
    </div>
  );
}

// ---------- Utility ----------
const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleDateString("ja-JP");
};
