import { NavLink } from "react-router";
import Header from "../components/Header";

export default function NotFoundPage() {
  return (
    <div className="h-full w-full">
      <Header />
      <div className="flex flex-col items-center justify-center gap-4 py-4">
        <p className="text-gray-600 text-xl">このページは見つかりませんでした。</p>
        <NavLink to={"/"} className="link">
          ホームに戻る
        </NavLink>
      </div>
    </div>
  );
}
