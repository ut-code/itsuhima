import { useState } from "react";
import { LuMenu, LuX } from "react-icons/lu";
import { NavLink } from "react-router";
import { EXTERNAL_LINKS } from "../constants/links";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-slate-200/60 border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <NavLink to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <img src="/logo.svg" alt="イツヒマ" className="h-8 w-8" />
            <span className="font-bold font-mplus text-slate-800 text-xl tracking-tight">イツヒマ</span>
            <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 font-medium text-[10px] text-slate-500 sm:inline-block">
              アルファ版
            </span>
          </NavLink>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          <a
            href={EXTERNAL_LINKS.GUIDE}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-slate-600 text-sm transition-colors hover:text-primary"
          >
            使い方
          </a>
          <NavLink to="/home" className="font-medium text-slate-600 text-sm transition-colors hover:text-primary">
            ホーム
          </NavLink>
          <div className="h-4 w-px bg-slate-200" />
          <NavLink
            to="/new"
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 font-semibold text-sm text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            イベント作成
          </NavLink>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <NavLink
            to="/new"
            className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1.5 font-semibold text-sm text-white shadow-sm transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            イベント作成
          </NavLink>
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <LuX className="h-6 w-6" /> : <LuMenu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="absolute top-16 left-0 w-full border-slate-100 border-b bg-white shadow-lg md:hidden">
          <div className="space-y-1 px-4 pt-2 pb-4">
            <NavLink
              to="/home"
              className="block rounded-md px-3 py-2 font-medium text-base text-slate-600 hover:bg-slate-50 hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              ホーム
            </NavLink>
            <a
              href={EXTERNAL_LINKS.GUIDE}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-md px-3 py-2 font-medium text-base text-slate-600 hover:bg-slate-50 hover:text-primary"
            >
              使い方ページ
            </a>
            <a
              href={EXTERNAL_LINKS.FEEDBACK}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-md px-3 py-2 font-medium text-base text-slate-600 hover:bg-slate-50 hover:text-primary"
            >
              ご意見・バグ報告
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
