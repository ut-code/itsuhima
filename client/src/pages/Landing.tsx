import { LuChevronRight, LuCircleCheck, LuPalette, LuSmartphone } from "react-icons/lu";
import { NavLink } from "react-router";
import Footer from "../components/Footer";
import Header from "../components/Header";

function HeroSection() {
  return (
    <section id="hero">
      <div className="overflow-hidden bg-slate-50">
        <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
            <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
              <h1 className="mb-6 font-bold text-4xl text-slate-900 leading-[1.25] tracking-tight sm:text-5xl md:text-6xl">
                <span className="text-primary">「いつヒマ？」</span>で<br />
                日程調整しよう
              </h1>
              <p className="mx-auto max-w-lg text-lg text-slate-600 lg:mx-0">
                とりあえずみんなの空いている時間を訊いてから、何を何時間やるか決めたい。そんな仲間うちでの調整に最適な、シンプルで直感的なツールです。
              </p>
              <NavLink to="/new" className="btn btn-primary btn-lg hover:-translate-y-0.5 mt-8 gap-2 px-8 py-6">
                イベントを作成
                <LuChevronRight className="h-6 w-6" />
              </NavLink>
            </div>

            <div className="mx-auto w-full max-w-[320px] lg:max-w-[400px]">
              <img src="/mock-mobile.png" alt="App Screenshot" className="h-auto w-full object-cover" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: <LuCircleCheck className="h-6 w-6 text-emerald-500" />,
      title: "候補日程は不要",
      description:
        "参加者が各々の空いている日程を入力することで日程調整を行います。幹事が候補日程を大量に作成する必要はありません。",
      color: "bg-emerald-50",
    },
    {
      icon: <LuPalette className="h-6 w-6 text-primary" />,
      title: "複数の参加形態に対応",
      description: "「対面」「オンライン」など、複数の参加形態を自由に設定可能です。",
      color: "bg-primary/10",
    },
    {
      icon: <LuSmartphone className="h-6 w-6 text-blue-500" />,
      title: "スマホでも簡単に入力可能",
      description: "スマホでも、複数の日程をドラッグで一気に選択可能です。",
      color: "bg-blue-50",
    },
  ] as const;

  return (
    <section id="features">
      <div className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto text-center">
            <h2 className="font-bold text-3xl text-slate-900 sm:text-4xl">イツヒマの特徴</h2>
            <p className="mt-4 text-lg text-slate-600">イツヒマは仲間うちでのスムーズな日程調整に特化しています。</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col rounded-lg border border-slate-100 bg-white p-8 shadow-sm"
              >
                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-lg ${feature.color}`}>
                  {feature.icon}
                </div>
                <h3 className="mt-6 font-bold text-slate-900 text-xl">{feature.title}</h3>
                <p className="mt-3 text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
}
