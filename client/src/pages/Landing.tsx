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
      <div
        className="
      relative z-10
      container mx-auto px-6
      py-16 md:py-20
      flex flex-col
      lg:flex-row items-center
      gap-12 sm:gap-14 lg:gap-10 xl:gap-14
      max-w-5xl
    "
      >
        <div className="text-center lg:text-left max-w-lg grow">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 leading-snug">
            <span className="text-primary">「いつヒマ？」</span>で<br />
            日程調整しよう
          </h1>
          <p className="mt-6 text-md md:text-xl text-gray-600 leading-relaxed">
            とりあえずみんなの空いている時間を訊いてから、何を何時間やるか決めたい。そんな仲間うちでの日程調整に最適なツールです。
          </p>
          <NavLink to="/new" className="btn btn-primary btn-lg mt-10 px-8 shadow-lg hover:shadow-xl duration-300">
            今すぐイベントを作成
          </NavLink>
        </div>
        <div className="relative shrink-0 w-60 sm:w-64 md:w-72 lg:w-80 xl:w-[22rem]">
          <div aria-hidden className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" />
          <img src="/mock-mobile.png" alt="イツヒマアプリの画面" className="relative w-72 h-auto" />
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
    <section className="px-4 py-16 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">イツヒマの特長</h2>
          <p className="text-md text-gray-600">仲間うちでのスムーズな日程調整に特化</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-gray-50 rounded-xl p-6 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">{feature.title}</h3>
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
    <footer className="bg-primary text-white px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8 md:gap-16">
          <div>
            <h3 className="text-xl font-bold mb-4">イツヒマについて</h3>
            <p className="text-sm opacity-90 leading-relaxed">
              イツヒマは、「いつヒマ？」で日程調整できるツールです。
              <br />
              候補日程の設定なしで、仲間うちでの日程調整をスムーズに行うことができます。
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">リンク</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://utcode.notion.site/1e4ca5f557bc80f2b697ca7b9342dc89?pvs=4"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="opacity-90 hover:opacity-100 transition-opacity duration-200 block"
                >
                  使い方ページ
                </a>
              </li>
              <li>
                <a
                  href="https://forms.gle/AB6xbgKjnDv5m1nm6"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="opacity-90 hover:opacity-100 transition-opacity duration-200 block"
                >
                  ご意見・バグ報告
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/20 mt-8 pt-8 text-center">
          <p className="text-sm opacity-75">© 2024 イツヒマ (アルファ版)</p>
        </div>
      </div>
    </footer>
  );
}
