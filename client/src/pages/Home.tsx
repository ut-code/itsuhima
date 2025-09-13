import { hc } from "hono/client";
import { useEffect, useState } from "react";
import { HiOutlineCalendar, HiOutlineCog, HiOutlinePlus, HiOutlineUser, HiOutlineUsers } from "react-icons/hi";
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
        <div className="min-h-[calc(100dvh_-_64px)] bg-blue-50 flex items-center justify-center">
          <div className="py-4">
            <span className="loading loading-dots loading-md text-gray-400" />
          </div>
        </div>
      ) : involvedProjects ? (
        <ProjectDashboard involvedProjects={involvedProjects} />
      ) : (
        <div className="min-h-[calc(100dvh_-_64px)] bg-blue-50 flex items-center justify-center">
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
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mt-2 mb-6">
            <img src="/logo.svg" alt="logo" width={48} className="mr-4" />
            <h1 className="text-4xl text-primary font-mplus">イツヒマ</h1>
          </div>
          <p className="text-xl text-gray-600 mb-8">「いつヒマ？」で日程調整しよう</p>
          <NavLink
            to="/new"
            className="btn btn-primary btn-lg px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            <HiOutlinePlus className="mr-2" size={20} />
            新しいイベントを作成
          </NavLink>
        </div>

        {involvedProjects.length > 0 && (
          <div className="space-y-8">
            {/* All Projects */}
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <HiOutlineCalendar className="mr-3 text-gray-700" size={28} />
                あなたのイベント
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      to={`/${project.id}`}
      className={`group relative block bg-white rounded-xl shadow-lg hover:shadow-xl
                  transition-all duration-300 transform hover:-translate-y-1 overflow-hidden
                  border-l-4 ${project.isHost ? "border-primary" : "border-secondary"}
                  focus:outline-none focus:ring-4 focus:ring-primary/20`}
      aria-label={`「${project.name}」の詳細を見る`}
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 mr-2">
            <h3 className="text-xl font-semibold text-gray-800 mb-2 break-words">{project.name}</h3>
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

          {project.isHost && (
            <NavLink
              to={`/${project.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="btn btn-ghost btn-sm px-3 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <HiOutlineCog size={14} />
              <span className="text-xs">管理</span>
            </NavLink>
          )}
        </div>

        <div className="flex items-center text-gray-600 mb-4">
          <HiOutlineCalendar className="mr-2" size={16} />
          <span className="text-sm">
            {formatDate(project.startDate.toLocaleDateString())} ～{formatDate(project.endDate.toLocaleDateString())}
          </span>
        </div>
      </div>

      <span
        className={`absolute bottom-4 right-4 ${project.isHost ? "text-primary" : "text-secondary"} text-2xl pointer-events-none
                   group-hover:translate-x-1 transition-transform`}
        aria-hidden="true"
      >
        &rsaquo;
      </span>
    </NavLink>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="mb-8">
        <div className="w-32 h-32 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <HiOutlineCalendar className="text-gray-400" size={64} />
        </div>
        <h3 className="text-2xl font-semibold text-gray-800 mb-3">まだイベントがありません</h3>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">イベントを作成して、日程調整を始めましょう</p>
      </div>
      <NavLink
        to="/new"
        className="btn btn-primary btn-lg px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
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
