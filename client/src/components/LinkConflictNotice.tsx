import { hc } from "hono/client";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import type { AppType } from "../../../server/src/routes/api";
import { authClient, consumeJustLoggedIn } from "../lib/auth";
import { API_ENDPOINT } from "../utils";

const client = hc<AppType>(API_ENDPOINT);

type LinkConflict = { eventId: string; eventName: string; isHost: boolean; name: string };

/**
 * ログインした直後に、アカウントに紐づけなかった、このブラウザの参加者を知らせる。
 * 同じイベントに、すでにアカウントの参加者 (別の端末での回答など) があるときに起きる。
 * ログインしている間はアカウントの方が「自分」として表示されるので、このブラウザでの参加が見えなくなったことを伝える。
 */
export default function LinkConflictNotice() {
  const { data: session, isPending } = authClient.useSession();
  const [conflicts, setConflicts] = useState<LinkConflict[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isPending || !session || !consumeJustLoggedIn()) return;
    (async () => {
      try {
        const res = await client.events.mine["link-conflicts"].$get({}, { init: { credentials: "include" } });
        if (res.status !== 200) return;
        setConflicts(await res.json());
      } catch (error) {
        // 知らせるだけなので、取れなくても何もしない
        console.error(error);
      }
    })();
  }, [isPending, session]);

  useEffect(() => {
    if (conflicts.length > 0) dialogRef.current?.showModal();
  }, [conflicts]);

  if (conflicts.length === 0) return null;

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box">
        <h3 className="mb-2 font-bold text-base-content text-lg">アカウントに紐づけなかった回答があります</h3>
        <p className="mb-4 text-base-content/70 text-sm">
          {"次のイベントには、アカウントでの回答と、このブラウザ上での回答の両方が存在します。"}
          {"現在はアカウントでログインしています。このブラウザ上での回答を編集するには、ログアウトしてください。"}
        </p>
        <ul className="mb-2 space-y-2">
          {conflicts.map((c) => (
            <li key={c.eventId} className="rounded-lg bg-base-200 px-3 py-2 text-sm">
              <NavLink
                to={`/e/${c.eventId}`}
                className="font-medium text-primary hover:underline"
                onClick={() => dialogRef.current?.close()}
              >
                {c.eventName}
              </NavLink>
              <div className="text-base-content/70">{describe(c)}</div>
            </li>
          ))}
        </ul>
        <div className="modal-action">
          <button type="button" className="btn btn-primary" onClick={() => dialogRef.current?.close()}>
            閉じる
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">閉じる</button>
      </form>
    </dialog>
  );
}

function describe({ isHost, name }: LinkConflict) {
  return isHost ? `このブラウザで作成し、「${name}」として回答` : `このブラウザで「${name}」として回答`;
}
