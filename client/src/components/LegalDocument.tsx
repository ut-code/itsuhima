import type { ReactNode } from "react";
import Footer from "./Footer";
import Header from "./Header";

/**
 * プライバシーポリシーや利用規約のような、見出しと本文が並ぶページの枠。
 */
export function LegalDocument({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <article className="rounded-3xl border border-base-300 bg-base-100 p-6 text-base-content/80 sm:p-10">
          <h1 className="font-bold text-3xl text-base-content tracking-tight">{title}</h1>
          <p className="mt-2 text-base-content/50 text-sm">最終更新日: {lastUpdated}</p>
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-bold text-base-content text-xl">{title}</h2>
      <div className="mt-4 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}
