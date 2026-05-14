import { LuCircleAlert, LuHouse } from "react-icons/lu";
import { NavLink } from "react-router";
import Header from "../components/Header";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex min-h-[500px] flex-col items-center justify-center rounded-3xl border border-base-300 border-dashed bg-base-100/50 p-8 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-base-200 shadow-sm ring-1 ring-base-300">
            <LuCircleAlert className="h-12 w-12 text-base-content/40" />
          </div>
          <h1 className="mb-3 font-bold text-4xl text-base-content tracking-tight">404</h1>
          <h2 className="mb-2 font-bold text-base-content text-xl">ページが見つかりません</h2>
          <p className="mb-8 max-w-md text-base-content/70">
            お探しのページは存在しないか、移動または削除された可能性があります。
          </p>
          <NavLink to="/home" className="btn btn-primary btn-lg gap-2">
            <LuHouse className="h-5 w-5" />
            ホームに戻る
          </NavLink>
        </div>
      </main>
    </div>
  );
}
