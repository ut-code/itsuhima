export default function Header() {
  return (
    <div className="navbar bg-primary shadow-sm sticky top-0 left-0 z-50">
      <div className="flex-1">
        <a className="flex text-2xl font-bold text-white items-center px-2 gap-1" href="/">
          <img src="/logo-white.svg" alt="logo" width={24} />
          <span className="px-2">イツヒマ</span>
        </a>
      </div>
    </div>
  );
}
