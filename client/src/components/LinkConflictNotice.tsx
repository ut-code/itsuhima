import { hc } from "hono/client";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import type { AppType } from "../../../server/src/app";
import { authClient, consumeJustLoggedIn, LOGIN_ENABLED } from "../lib/auth";
import { API_ENDPOINT } from "../utils";

const client = hc<AppType>(API_ENDPOINT);

type LinkConflict = { eventId: string; eventName: string; isHost: boolean; name: string | null };

/**
 * ログインした直後に、アカウントに紐づけなかった、このブラウザの参加者を知らせる。
 * 同じイベントに、すでにアカウントの参加者 (別の端末での回答など) があるときに起きる。
 * ログインしている間はアカウントの方が「自分」として表示されるので、このブラウザでの参加が見えなくなったことを伝える。
 */
export default function LinkConflictNotice() {
  if (!LOGIN_ENABLED) return null;
  return <LinkConflictNoticeInner />;
}

function LinkConflictNoticeInner() {
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
        <h3 className="mb-2 font-bold text-base-content text-lg">アカウントに紐づけなかった参加があります</h3>
        <p className="mb-4 text-base-content/70 text-sm">
          {"次のイベントには、このアカウントでの参加 (別の端末での回答など) がすでにあるため、"}
          {"このブラウザでの参加は紐づけていません。"}
          {"ログインしている間は、アカウントでの参加が表示されます。どちらも消えてはいません。"}
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
  const answer = name ? `「${name}」として回答` : null;
  if (isHost) return answer ? `このブラウザで作成し、${answer}` : "このブラウザで作成";
  return `このブラウザで${answer ?? "参加"}`;
}
