import { HiOutlineCalendar, HiOutlineClock, HiOutlineCog, HiOutlinePlus, HiOutlineUsers } from "react-icons/hi";
import { NavLink } from "react-router";
import { type InvolvedProjects, involvedProjectsResSchema } from "../../../common/schema";
import Header from "../components/Header";
import { useData } from "../hooks";
import { API_ENDPOINT } from "../utils";

export default function HomePage() {
  const { data: involvedProjects, loading } = useData(`${API_ENDPOINT}/projects/mine`, involvedProjectsResSchema);

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

function ProjectDashboard({ involvedProjects }: { involvedProjects: InvolvedProjects }) {
  const hostProjects = involvedProjects.filter((p) => p.isHost);
  const guestProjects = involvedProjects.filter((p) => !p.isHost);

  return (
    <div className="min-h-screen bg-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">おかえりなさい！</h1>
          <p className="text-xl text-gray-600 mb-8">あなたのイベントを管理して、日程調整をスムーズに進めましょう</p>
          <NavLink
            to="/new"
            className="btn btn-primary btn-lg px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            <HiOutlinePlus className="mr-2" size={20} />
            新しいイベントを作成
          </NavLink>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-primary/10 rounded-lg mr-4">
                <HiOutlineCalendar className="text-primary" size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{involvedProjects.length}</h3>
                <p className="text-gray-600">総イベント数</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-success/10 rounded-lg mr-4">
                <HiOutlineUsers className="text-success" size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{hostProjects.length}</h3>
                <p className="text-gray-600">主催イベント</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-warning/10 rounded-lg mr-4">
                <HiOutlineClock className="text-warning" size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{guestProjects.length}</h3>
                <p className="text-gray-600">参加イベント</p>
              </div>
            </div>
          </div>
        </div>

        {involvedProjects.length > 0 ? (
          <div className="space-y-8">
            {/* Host Projects */}
            {hostProjects.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <HiOutlineUsers className="mr-3 text-primary" size={28} />
                  あなたが主催するイベント
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hostProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </section>
            )}

            {/* Guest Projects */}
            {guestProjects.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <HiOutlineClock className="mr-3 text-success" size={28} />
                  参加しているイベント
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {guestProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: InvolvedProjects[0] }) {
  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold text-gray-800 flex-1 mr-2">{project.name}</h3>
          {project.isHost && (
            <div className="flex items-center">
              <span className="badge badge-primary badge-sm mr-2">主催</span>
              <NavLink className="btn btn-ghost btn-sm p-1" to={`/${project.id}/edit`}>
                <HiOutlineCog className="text-gray-400 hover:text-gray-600" size={18} />
              </NavLink>
            </div>
          )}
        </div>

        <div className="flex items-center text-gray-600 mb-4">
          <HiOutlineCalendar className="mr-2" size={16} />
          <span className="text-sm">
            {formatDate(project.startDate.toLocaleDateString())} ～ {formatDate(project.endDate.toLocaleDateString())}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-gray-500 text-sm">
            <HiOutlineClock className="mr-1" size={14} />
            <span>{project.isHost ? "管理中" : "回答済み"}</span>
          </div>
          <NavLink to={`/${project.id}`} className="btn btn-primary btn-sm px-4">
            詳細を見る
          </NavLink>
        </div>
      </div>

      <div className={`h-1 ${project.isHost ? "bg-primary" : "bg-success"}`} />
    </div>
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
