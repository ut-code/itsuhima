import { NavLink } from "react-router";
import Header from "../components/Header";

export default function NotFoundPage() {
  return (
    <div className="h-full w-full">
      <Header />
      <div className="flex flex-col justify-center items-center py-4 gap-4">
        <p className="text-xl text-gray-600">このページは見つかりませんでした。</p>
        <NavLink to={"/"} className="link">
          ホームに戻る
        </NavLink>
      </div>
    </div>
  );
}
