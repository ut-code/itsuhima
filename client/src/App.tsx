import { NavLink } from "react-router";
import { Calendar } from "./Calendar";

function App() {
  return (
    <>
      <h1 className="text-4xl">トップページ</h1>
      <NavLink to="/create" end>
        イベントを作成する。
      </NavLink>
      <Calendar />
    </>
  );
}

export default App;
