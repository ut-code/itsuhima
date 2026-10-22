const MS_PER_MINUTE = 60 * 1000;

/** timezone での日付 ("YYYY-MM-DD") と、0 時からの経過分を求める関数を作る */
export function wallClockIn(timezone: string): (value: Date) => { date: string; minutes: number } {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (value) => {
    const parts = Object.fromEntries(format.formatToParts(value).map((p) => [p.type, p.value]));
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
  };
}

/** 0 時からの経過分を "HH:mm" にする */
export function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "HH:mm" を 0 時からの経過分にする */
export function parseMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/** timezone の壁時計での日付 ("YYYY-MM-DD") と時刻 ("HH:mm") が指す瞬間 */
export function fromWallClock(date: string, time: string, timezone: string): Date {
  const toWallClock = wallClockIn(timezone);
  const target = Date.parse(`${date}T00:00:00.000Z`) + parseMinutes(time) * MS_PER_MINUTE;
  // UTC として読んだ値から、その付近のオフセットを引く。オフセットが変わる境目をまたぐときのために 2 回合わせる
  let instant = target;
  for (let i = 0; i < 2; i++) {
    const wall = toWallClock(new Date(instant));
    const wallAsUtc = Date.parse(`${wall.date}T00:00:00.000Z`) + wall.minutes * MS_PER_MINUTE;
    instant += target - wallAsUtc;
  }
  return new Date(instant);
}
