import { useState } from "react";
import { LuMenu, LuX } from "react-icons/lu";
import { NavLink } from "react-router";
import { EXTERNAL_LINKS } from "../constants/links";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-base-300 border-b bg-base-100">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NavLink to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <img src="/logo.svg" alt="イツヒマ" className="h-6 w-6" />
          <span className="font-bold font-mplus text-base-content text-xl tracking-tight">イツヒマ</span>
          <span className="rounded-full bg-base-200 px-2 py-0.5 font-medium text-[10px] text-base-content/50">
            アルファ版
          </span>
        </NavLink>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/home" className="font-medium text-base-content/70 text-sm transition-colors hover:text-primary">
            ホーム
          </NavLink>
          <a
            href={EXTERNAL_LINKS.GUIDE}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-base-content/70 text-sm transition-colors hover:text-primary"
          >
            使い方
          </a>
        </nav>

        <div className="flex items-center md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-base-content/70 hover:bg-base-200"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMenuOpen ? <LuX className="h-6 w-6" /> : <LuMenu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div
          id="mobile-menu"
          className="absolute top-16 left-0 w-full border-base-300 border-b bg-base-100 shadow-lg md:hidden"
        >
          <div className="flex flex-col gap-1 px-4 pt-2 pb-4">
            <NavLink
              to="/home"
              className="block rounded-lg px-3 py-2 font-medium text-base text-base-content/70 hover:bg-base-200 hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              ホーム
            </NavLink>
            <a
              href={EXTERNAL_LINKS.GUIDE}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-lg px-3 py-2 font-medium text-base text-base-content/70 hover:bg-base-200 hover:text-primary"
            >
              使い方ページ
            </a>
            <a
              href={EXTERNAL_LINKS.FEEDBACK}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-lg px-3 py-2 font-medium text-base text-base-content/70 hover:bg-base-200 hover:text-primary"
            >
              ご意見・バグ報告
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
