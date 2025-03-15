export default function Header() {
  return (
    <div className="navbar bg-primary shadow-sm">
      <div className="flex-1">
        <a className="flex text-2xl font-bold text-white gap-3 items-center px-2" href="/">
          <img src="/logo.png" alt="logo" width="50px" />
          <span>イツヒマ</span>
        </a>
      </div>
    </div>
  );
}
