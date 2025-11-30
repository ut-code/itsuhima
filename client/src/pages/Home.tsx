import { hc } from "hono/client";
import { useEffect, useState } from "react";
import { HiOutlineCalendar, HiOutlinePlus, HiOutlineUser, HiOutlineUsers } from "react-icons/hi";
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
          setInvolvedProjects(null);
        }
      } catch (error) {
        console.error("Error fetching involved projects:", error);
        setInvolvedProjects(null);
      } finally {
        setLoading(false);
      }
    };
    fetchInvolvedProjects();
  }, []);

  return (
    <>
      <Header />
      {loading ? (
        <div className="flex min-h-[calc(100dvh_-_64px)] items-center justify-center bg-blue-50">
          <div className="py-4">
            <span className="loading loading-dots loading-md text-gray-400" />
          </div>
        </div>
      ) : involvedProjects ? (
        <ProjectDashboard involvedProjects={involvedProjects} />
      ) : (
        <div className="flex min-h-[calc(100dvh_-_64px)] items-center justify-center bg-blue-50">
          <EmptyState />
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
    <div className="min-h-[calc(100dvh_-_64px)] bg-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="mt-2 mb-6 flex items-center justify-center">
            <img src="/logo.svg" alt="logo" width={48} className="mr-4" />
            <h1 className="font-mplus text-4xl text-primary">イツヒマ</h1>
          </div>
          <p className="mb-8 text-gray-600 text-xl">「いつヒマ？」で日程調整しよう</p>
          <NavLink
            to="/new"
            className="btn btn-primary btn-lg hover:-translate-y-1 transform px-8 py-4 text-lg shadow-lg transition-all duration-300 hover:shadow-xl"
          >
            <HiOutlinePlus className="mr-2" size={20} />
            新しいイベントを作成
          </NavLink>
        </div>

        {involvedProjects.length > 0 && (
          <div className="space-y-8">
            {/* All Projects */}
            <section>
              <h2 className="mb-6 flex items-center font-bold text-2xl text-gray-800">
                <HiOutlineCalendar className="mr-3 text-gray-700" size={28} />
                あなたのイベント
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sortedProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: BriefProject }) {
  return (
    <NavLink
      to={`/e/${project.id}`}
      className={`group hover:-translate-y-1 relative block transform overflow-hidden rounded-xl border-l-4 bg-white shadow-lg transition-all duration-300 hover:shadow-xl ${project.isHost ? "border-primary" : "border-secondary"} focus:outline-none focus:ring-4 focus:ring-primary/20`}
      aria-label={`「${project.name}」の詳細を見る`}
    >
      <div className="p-6">
        <div className="mb-4">
          <h3 className="mb-2 break-words font-semibold text-gray-800 text-xl">{project.name}</h3>
          <span className={`badge badge-sm ${project.isHost ? "badge-primary" : "badge-secondary"}`}>
            {project.isHost ? (
              <>
                <HiOutlineUser size={12} />
                <span>主催者</span>
              </>
            ) : (
              <>
                <HiOutlineUsers size={12} />
                <span>参加者</span>
              </>
            )}
          </span>
        </div>

        <div className="mb-4 flex items-center text-gray-600">
          <HiOutlineCalendar className="mr-2" size={16} />
          <span className="text-sm">
            {formatDate(project.startDate.toLocaleDateString())} ～{formatDate(project.endDate.toLocaleDateString())}
          </span>
        </div>
      </div>

      <span
        className={`absolute right-4 bottom-4 ${project.isHost ? "text-primary" : "text-secondary"} pointer-events-none text-2xl transition-transform group-hover:translate-x-1`}
        aria-hidden="true"
      >
        &rsaquo;
      </span>
    </NavLink>
  );
}

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <div className="mb-8">
        <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-gray-100">
          <HiOutlineCalendar className="text-gray-400" size={64} />
        </div>
        <h3 className="mb-3 font-semibold text-2xl text-gray-800">まだイベントがありません</h3>
        <p className="mx-auto mb-8 max-w-md text-gray-600">イベントを作成して、日程調整を始めましょう</p>
      </div>
      <NavLink
        to="/new"
        className="btn btn-primary btn-lg px-8 py-4 text-lg shadow-lg transition-all duration-300 hover:shadow-xl"
      >
        <HiOutlinePlus className="mr-2" size={20} />
        イベントを作成する
      </NavLink>
    </div>
  );
}

// ---------- Utility ----------
const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleDateString("ja-JP");
};
