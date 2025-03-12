import { UserSchema } from "../../common/schema";
import { z } from "zod";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";

async function sampleFetch() {
  const response = await fetch("http://localhost:3000/users/");
  const result = await response.json();
  const data = z.array(UserSchema).parse(result);
  data.forEach((item) => console.log("name: ", item.name, "age: ", item.age));
}

async function sampleEventFetch() {
  const response = await fetch("http://localhost:3000/sample/events");
  const result = await response.json();
  console.log(result);
}

function App() {
  return (
    <>
      <h1 className="text-4xl">Vite + React</h1>
      <FullCalendar plugins={[timeGridPlugin]} />
      <div>
        <button className="btn" onClick={sampleFetch}>
          fetch
        </button>
        <button className="btn" onClick={sampleEventFetch}>
          events
        </button>
      </div>
    </>
  );
}

export default App;
