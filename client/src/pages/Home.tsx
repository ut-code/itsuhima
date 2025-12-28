import { hc } from "hono/client";
import { useEffect, useState } from "react";
import { LuArrowRight, LuCalendar, LuLayoutDashboard, LuPlus, LuUser, LuUsers } from "react-icons/lu";
import { NavLink } from "react-router";
import type { AppType } from "../../../server/src/main";
import Header from "../components/Header";
import { briefProjectReviver } from "../revivers";
import type { BriefProject } from "../types";
import { API_ENDPOINT } from "../utils";

const client = hc<AppType>(API_ENDPOINT);

export default function HomePage() {
  const [involvedProjects, setInvolvedProjects] = useState<BriefProject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  useEffect(() => {
    const fetchInvolvedProjects = async () => {
      setLoading(true);
      try {
        const res = await client.projects.mine.$get({}, { init: { credentials: "include" } });
        if (res.status === 200) {
          const data = await res.json();
          const parsedData = data.map((p) => briefProjectReviver(p));
          setInvolvedProjects(parsedData);
        } else {
          let errorMessage = "イベントの取得に失敗しました。";
          try {
            const data = await res.json();
            const err = data as unknown as { message: string }; // Middleware のレスポンスは Hono RPC の型に乗らない
            if (typeof err.message === "string" && err.message.trim()) {
              errorMessage = err.message.trim();
            }
          } catch (_) {
            // レスポンスがJSONでない場合は無視
          }
          setToast({
            message: errorMessage,
            variant: "error",
          });
          setTimeout(() => setToast(null), 5000);
          setInvolvedProjects(null);
        }
      } catch (error) {
        console.error("Error fetching involved projects:", error);
        setToast({
          message: "ネットワークエラーが発生しました。",
          variant: "error",
        });
        setTimeout(() => setToast(null), 5000);
        setInvolvedProjects(null);
      } finally {
        setLoading(false);
      }
    };
    fetchInvolvedProjects();
  }, []);

  return (
    <>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-bold text-2xl text-slate-900 tracking-tight sm:text-3xl">ホーム</h1>
              <p className="mt-1 text-slate-500 text-sm">参加・主催しているイベントの管理</p>
            </div>
          </div>
          {loading ? (
            <ProjectsSkeleton />
          ) : involvedProjects && involvedProjects.length > 0 ? (
            <ProjectDashboard involvedProjects={involvedProjects} />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
      {toast && (
        <div className="toast toast-top toast-center z-50">
          <div className={`alert ${toast.variant === "success" ? "alert-success" : "alert-error"}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}

function ProjectDashboard({ involvedProjects }: { involvedProjects: BriefProject[] }) {
  const sortedProjects = [...involvedProjects].sort((a, b) => {
    if (a.isHost !== b.isHost) {
      return a.isHost ? -1 : 1;
    }
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <NavLink
          to="/new"
          className="group relative flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-slate-200 border-dashed bg-white/50 p-6 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-primary/10">
            <LuPlus className="h-6 w-6 text-slate-400 group-hover:text-primary" />
          </div>
          <h3 className="font-semibold text-slate-900">新規作成</h3>
          <p className="mt-1 text-slate-500 text-sm">新しい日程調整を始める</p>
        </NavLink>

        {sortedProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: BriefProject }) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  };

  return (
    <NavLink
      to={`/e/${project.id}`}
      className="group hover:-translate-y-1 relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-slate-200/60 hover:shadow-xl"
    >
      <div>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-xs ring-1 ring-inset ${
                project.isHost
                  ? "bg-primary/10 text-primary ring-primary/20"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              }`}
            >
              {project.isHost ? (
                <>
                  <LuUser className="h-3 w-3" />
                  主催
                </>
              ) : (
                <>
                  <LuUsers className="h-3 w-3" />
                  参加
                </>
              )}
            </span>
            <h3 className="line-clamp-2 font-bold text-lg text-slate-900 leading-tight transition-colors group-hover:text-primary">
              {project.name}
            </h3>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-slate-600 text-sm">
          <LuCalendar className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="flex items-center gap-2 font-medium">
            <span>{formatDate(project.startDate)}</span>
            <span className="text-slate-300">/</span>
            <span>{formatDate(project.endDate)}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-slate-100 border-t pt-4">
        <span className="font-medium text-slate-500 text-xs transition-colors group-hover:text-primary">
          詳細を見る
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all group-hover:bg-primary group-hover:text-white">
          <LuArrowRight className="h-4 w-4" />
        </div>
      </div>
    </NavLink>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-slate-300 border-dashed bg-slate-50/50 p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
        <LuLayoutDashboard className="h-10 w-10 text-slate-400" />
      </div>
      <h3 className="mb-2 font-bold text-slate-900 text-xl">まだイベントがありません</h3>
      <p className="mb-8 max-w-sm text-slate-500">「イベント作成」ボタンから、新しい日程調整を始めましょう。</p>
      <NavLink
        to="/new"
        className="hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 font-semibold text-base text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-xl"
      >
        <LuPlus className="h-5 w-5" />
        イベント作成
      </NavLink>
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is static
          key={`skeleton-${i}`}
          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="h-7 w-3/4 animate-pulse rounded-md bg-slate-100" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-slate-50" />
          </div>
          <div className="mt-6 flex items-center justify-between border-slate-100 border-t pt-4">
            <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
