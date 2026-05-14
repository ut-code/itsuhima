import { EXTERNAL_LINKS } from "../constants/links";

export default function Footer() {
  return (
    <footer className="bg-neutral py-12 text-neutral-content/70">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="grid gap-12 md:grid-cols-2 lg:gap-24">
          <div>
            <div className="flex items-center gap-2 text-neutral-content">
              <img src="/logo-white.svg" alt="イツヒマ" className="h-6 w-6" />
              <span className="font-bold font-mplus text-xl tracking-tight">イツヒマ</span>
            </div>
            <p className="mt-6 max-w-md text-neutral-content/50 text-sm">「いつヒマ？」で日程調整しよう</p>
          </div>
          <div>
            <h3 className="font-bold text-neutral-content text-sm">サポート</h3>
            <ul className="mt-4 text-sm">
              <li>
                <a
                  href={EXTERNAL_LINKS.GUIDE}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-neutral-content/50"
                >
                  使い方
                </a>
              </li>
              <li className="mt-3">
                <a
                  href={EXTERNAL_LINKS.FEEDBACK}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-neutral-content/50"
                >
                  ご意見・バグ報告
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-neutral-content/10 border-t pt-8 text-center text-neutral-content/40 text-xs">
          <p>&copy; {new Date().getFullYear()} イツヒマ All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
