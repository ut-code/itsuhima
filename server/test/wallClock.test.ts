import { describe, expect, test } from "vitest";
import { fromWallClock } from "../src/lib/wallClock.js";

describe("fromWallClock", () => {
  test("timezone の壁時計の日時を UTC の瞬間にする", () => {
    expect(fromWallClock("2026-11-02", "08:00", "Asia/Tokyo").toISOString()).toBe("2026-11-01T23:00:00.000Z");
    expect(fromWallClock("2026-11-02", "23:45", "Asia/Tokyo").toISOString()).toBe("2026-11-02T14:45:00.000Z");
  });

  test("夏時間の有無でオフセットが変わる日も合わせる", () => {
    // 2026/03/08 02:00 に EST (-5) から EDT (-4) に変わる
    expect(fromWallClock("2026-03-08", "01:00", "America/New_York").toISOString()).toBe("2026-03-08T06:00:00.000Z");
    expect(fromWallClock("2026-03-08", "03:00", "America/New_York").toISOString()).toBe("2026-03-08T07:00:00.000Z");
  });
});
