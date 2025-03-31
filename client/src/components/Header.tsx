import { NavLink } from "react-router";

export default function Header() {
  return (
    <div className="navbar bg-primary shadow-sm sticky top-0 left-0 z-50">
      <div className="flex-1">
        <NavLink className="flex text-2xl text-white items-center px-2 gap-1 font-mplus" to="/">
          <img src="/logo-white.svg" alt="logo" width={24} />
          <span className="px-2">イツヒマ</span>
          <span className="text-xs">(アルファ版)</span>
        </NavLink>
      </div>
    </div>
  );
}
