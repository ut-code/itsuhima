import { hc } from "hono/client";
import { useEffect, useState } from "react";
import { LuCalendar, LuChevronRight, LuLayoutList, LuPlus, LuUser, LuUsers, LuX } from "react-icons/lu";
import { NavLink } from "react-router";
import type { AppType } from "../../../server/src/main";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { briefEventReviver } from "../revivers";
import type { BriefEvent } from "../types";
import { API_ENDPOINT, readErrorMessage } from "../utils";

const client = hc<AppType>(API_ENDPOINT);

export default function HomePage() {
  const [involvedEvents, setInvolvedEvents] = useState<BriefEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  useEffect(() => {
    const fetchInvolvedEvents = async () => {
      setLoading(true);
      try {
        const res = await client.events.mine.$get({}, { init: { credentials: "include" } });
        if (res.status === 200) {
          const data = await res.json();
          const parsedData = data.map((p) => briefEventReviver(p));
          setInvolvedEvents(parsedData);
        } else {
          const errorMessage = await readErrorMessage(res, "イベントの取得に失敗しました。");
          setToast({
            message: errorMessage,
            variant: "error",
          });
          setTimeout(() => setToast(null), 5000);
          setInvolvedEvents(null);
        }
      } catch (error) {
        console.error("Error fetching involved events:", error);
        setToast({
          message: "ネットワークエラーが発生しました。",
          variant: "error",
        });
        setTimeout(() => setToast(null), 5000);
        setInvolvedEvents(null);
      } finally {
        setLoading(false);
      }
    };
    fetchInvolvedEvents();
  }, []);

  return (
    <>
      <div className="flex min-h-screen flex-col bg-base-200 text-base-content">
        <Header />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-bold text-2xl text-base-content tracking-tight sm:text-3xl">ホーム</h1>
            </div>
            <NavLink to="/new" className="btn btn-primary w-full gap-2 sm:w-auto">
              <LuPlus className="h-4 w-4" />
              新規作成
            </NavLink>
          </div>
          {loading ? (
            <EventsSkeleton />
          ) : involvedEvents && involvedEvents.length > 0 ? (
            <EventDashboard involvedEvents={involvedEvents} />
          ) : (
            <EmptyState />
          )}
        </main>
        <Footer />
      </div>
      {toast && (
        <div className="toast toast-top toast-center z-50" aria-live="polite" aria-atomic="true">
          <div className={`alert ${toast.variant === "success" ? "alert-success" : "alert-error"} text-sm`}>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="btn btn-circle btn-ghost btn-xs"
              aria-label="閉じる"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function EventDashboard({ involvedEvents }: { involvedEvents: BriefEvent[] }) {
  const hostedEvents = involvedEvents
    .filter((p) => p.isHost)
    .sort((a, b) => b.startDate.valueOf() - a.startDate.valueOf());

  const participatingEvents = involvedEvents
    .filter((p) => !p.isHost)
    .sort((a, b) => b.startDate.valueOf() - a.startDate.valueOf());

  return (
    <div className="space-y-8">
      {hostedEvents.length > 0 && (
        <EventSection title="主催しているイベント" icon={<LuUser className="h-5 w-5" />} events={hostedEvents} />
      )}

      {participatingEvents.length > 0 && (
        <EventSection
          title="参加しているイベント"
          icon={<LuUsers className="h-5 w-5" />}
          events={participatingEvents}
        />
      )}
    </div>
  );
}

function EventSection({ title, icon, events }: { title: string; icon: React.ReactNode; events: BriefEvent[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 text-base-content/80">
        {icon}
        <h2 className="font-bold text-lg">{title}</h2>
        <span className="ml-1 rounded-full bg-base-300 px-2 py-0.5 font-medium text-base-content/70 text-xs">
          {events.length}
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm">
        {events.map((event, index) => (
          <EventRow key={event.id} event={event} isLast={index === events.length - 1} />
        ))}
      </div>
    </section>
  );
}

function EventRow({ event, isLast }: { event: BriefEvent; isLast: boolean }) {
  return (
    <NavLink
      to={`/e/${event.id}`}
      className={`group flex items-center justify-between gap-4 p-4 transition-colors hover:bg-base-200 ${
        !isLast ? "border-base-300 border-b" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium text-base-content transition-colors group-hover:text-primary">
          {event.name}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-base-content/50 text-sm">
          <LuCalendar className="h-3.5 w-3.5 shrink-0" />
          <span>
            {event.startDate.format("YYYY年M月D日")} 〜 {event.endDate.format("YYYY年M月D日")}
          </span>
        </div>
      </div>
      <LuChevronRight className="h-5 w-5 shrink-0 text-base-content/40 transition-colors group-hover:text-primary" />
    </NavLink>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-base-300 bg-base-100 p-8 text-center shadow-sm">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-base-200">
        <LuLayoutList className="h-8 w-8 text-base-content/40" />
      </div>
      <h3 className="mb-2 font-bold text-base-content text-lg">まだイベントがありません</h3>
      <p className="max-w-sm text-base-content/50 text-sm">「新規作成」ボタンから、新しい日程調整を始めましょう。</p>
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((section) => (
        <div key={`section-${section}`}>
          <div className="mb-4 flex items-center gap-2">
            <div className="h-5 w-5 animate-pulse rounded bg-base-300" />
            <div className="h-5 w-40 animate-pulse rounded bg-base-300" />
          </div>
          <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm">
            {[1, 2, 3].map((row, index) => (
              <div
                key={`row-${section}-${row}`}
                className={`flex items-center justify-between gap-4 px-4 py-4 ${index < 2 ? "border-base-300 border-b" : ""}`}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-base-200" />
                  <div className="h-4 w-32 animate-pulse rounded bg-base-200" />
                </div>
                <div className="h-5 w-5 animate-pulse rounded bg-base-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
