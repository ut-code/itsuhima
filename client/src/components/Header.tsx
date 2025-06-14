import { HiOutlineQuestionMarkCircle } from "react-icons/hi";
import { NavLink } from "react-router";

export default function Header() {
  return (
    <div className="navbar bg-primary shadow-sm sticky top-0 left-0 z-50">
      <div className="flex-1">
        <NavLink className="flex text-2xl text-white items-center px-2 gap-1 font-mplus" to="/home">
          <img src="/logo-white.svg" alt="logo" width={24} />
          <span className="px-2">イツヒマ</span>
          <span className="text-xs">(アルファ版)</span>
        </NavLink>
        <div className="dropdown dropdown-end -translate-y-1/2 absolute top-1/2 right-3 transform text-gray-600">
          <button tabIndex={0} className="btn btn-circle btn-primary" type="button">
            <HiOutlineQuestionMarkCircle size={28} className="text-white" />
          </button>
          <div className="dropdown-content z-[1] w-56 rounded-box bg-base-100 p-2 shadow">
            <p className="p-2 text-xs">イツヒマは現在アルファ版です。</p>
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: daisyUI の仕様。tabIndex を消すとモバイルで開かないなどの問題が起こる */}
            <ul tabIndex={0} className="menu p-0">
              <li>
                <a
                  href="https://utcode.notion.site/1e4ca5f557bc80f2b697ca7b9342dc89?pvs=4"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  使い方ページ (臨時)
                </a>
              </li>
              <li>
                <a href="https://forms.gle/AB6xbgKjnDv5m1nm6" target="_blank" rel="noreferrer noopener">
                  ご意見・バグ報告
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
