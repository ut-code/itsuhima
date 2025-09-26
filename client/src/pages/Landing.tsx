import { NavLink } from "react-router";
import Header from "../components/Header";

export default function LandingPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <HeroSection />
        <FeaturesSection />
        <Footer />
      </div>
    </>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="container relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-12 px-6 py-16 sm:gap-14 md:py-20 lg:flex-row lg:gap-10 xl:gap-14 ">
        <div className="max-w-lg grow text-center lg:text-left">
          <h1 className="font-bold text-4xl text-gray-800 leading-snug md:text-5xl">
            <span className="text-primary">「いつヒマ？」</span>で<br />
            日程調整しよう
          </h1>
          <p className="mt-6 text-gray-600 text-md leading-relaxed md:text-xl">
            とりあえずみんなの空いている時間を訊いてから、何を何時間やるか決めたい。そんな仲間うちでの日程調整に最適なツールです。
          </p>
          <NavLink to="/new" className="btn btn-primary btn-lg mt-10 px-8 shadow-lg duration-300 hover:shadow-xl">
            今すぐイベントを作成
          </NavLink>
        </div>
        <div className="relative w-60 shrink-0 sm:w-64 md:w-72 lg:w-80 xl:w-[22rem]">
          <div aria-hidden className="-inset-8 absolute rounded-full bg-primary/10 blur-3xl" />
          <img src="/mock-mobile.png" alt="イツヒマアプリの画面" className="relative h-auto w-72" />
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: "🚫",
      title: "候補日程の設定なし",
      description: "みんなが空いている時間を選ぶだけなので、主催者が候補日程を設定する必要がありません。",
    },
    {
      icon: "🔗",
      title: "URLで簡単共有",
      description: "作成したイベントのURLをコピーして友達に送れば、すぐに日程調整が可能です。",
    },
    {
      icon: "📱",
      title: "直感的な操作",
      description: "複数日程も一気にドラッグで選択可能。スマホでも簡単に操作できます。",
    },
  ];

  return (
    <section className="bg-white px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-bold text-3xl text-gray-800">イツヒマの特長</h2>
          <p className="text-gray-600 text-md">仲間うちでのスムーズな日程調整に特化</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl bg-gray-50 p-6 transition-shadow duration-300 hover:shadow-lg"
            >
              <div className="mb-4 text-4xl">{feature.icon}</div>
              <h3 className="mb-3 font-semibold text-gray-800 text-xl">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-primary px-4 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 md:grid-cols-2 md:gap-16">
          <div>
            <h3 className="mb-4 font-bold text-xl">イツヒマについて</h3>
            <p className="text-sm leading-relaxed opacity-90">
              イツヒマは、「いつヒマ？」で日程調整できるツールです。
              <br />
              候補日程の設定なしで、仲間うちでの日程調整をスムーズに行うことができます。
            </p>
          </div>
          <div>
            <h3 className="mb-4 font-bold text-xl">リンク</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://utcode.notion.site/1e4ca5f557bc80f2b697ca7b9342dc89?pvs=4"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block opacity-90 transition-opacity duration-200 hover:opacity-100"
                >
                  使い方ページ
                </a>
              </li>
              <li>
                <a
                  href="https://forms.gle/AB6xbgKjnDv5m1nm6"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block opacity-90 transition-opacity duration-200 hover:opacity-100"
                >
                  ご意見・バグ報告
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-white/20 border-t pt-8 text-center">
          <p className="text-sm opacity-75">© 2024 イツヒマ (アルファ版)</p>
        </div>
      </div>
    </footer>
  );
}
