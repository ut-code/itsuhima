import { describe, expect, test } from "vitest";
import { type AvailabilityParticipant, findCandidates, summarizeAvailability } from "../../common/availability.js";

const event = { timezone: "Asia/Tokyo" };
const online = "option-online";
const offline = "option-offline";

/** JST の壁時計 ("2026-11-02 10:00") を UTC の ISO にする */
function jst(dateTime: string) {
  return new Date(`${dateTime.replace(" ", "T")}:00+09:00`).toISOString();
}

function participant(id: string, slots: [string, string, string?][]): AvailabilityParticipant {
  return {
    id,
    name: `名前-${id}`,
    slots: slots.map(([start, end, optionId = online]) => ({ startAt: jst(start), endAt: jst(end), optionId })),
  };
}

/** 比べやすい形 ("10:00-11:00 a,b") にする */
function summary(intervals: ReturnType<typeof summarizeAvailability>) {
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
  return intervals.map(
    (i) =>
      `${i.date} ${time(i.startAt)}-${time(i.endAt)} ${i.members
        .map((m) => m.participantId)
        .sort()
        .join(",")}`,
  );
}

describe("summarizeAvailability", () => {
  test("回答が無ければ空", () => {
    expect(summarizeAvailability(event, [])).toEqual([]);
    expect(summarizeAvailability(event, [participant("a", [])])).toEqual([]);
  });

  test("重なりで区間を分け、誰もいない区間は返さない", () => {
    const result = summarizeAvailability(event, [
      participant("a", [["2026-11-02 10:00", "2026-11-02 12:00"]]),
      participant("b", [["2026-11-02 11:00", "2026-11-02 13:00"]]),
      participant("c", [["2026-11-02 15:00", "2026-11-02 16:00"]]),
    ]);

    expect(summary(result)).toEqual([
      "2026-11-02 10:00-11:00 a",
      "2026-11-02 11:00-12:00 a,b",
      "2026-11-02 12:00-13:00 b",
      "2026-11-02 15:00-16:00 c",
    ]);
  });

  test("隣り合う Slot で参加者が同じなら 1 つにまとめる", () => {
    const result = summarizeAvailability(event, [
      participant("a", [
        ["2026-11-02 10:00", "2026-11-02 11:00"],
        ["2026-11-02 11:00", "2026-11-02 12:00"],
      ]),
    ]);

    expect(summary(result)).toEqual(["2026-11-02 10:00-12:00 a"]);
  });

  test("参加形態が変われば分ける", () => {
    const result = summarizeAvailability(event, [
      participant("a", [
        ["2026-11-02 10:00", "2026-11-02 11:00", online],
        ["2026-11-02 11:00", "2026-11-02 12:00", offline],
      ]),
    ]);

    expect(result.map((i) => i.members[0].optionId)).toEqual([online, offline]);
  });

  test("日付が変わるところではまとめない (24:00 に終わる Slot と、翌日の 0:00 に始まる Slot)", () => {
    const result = summarizeAvailability(event, [
      participant("a", [
        ["2026-11-02 23:00", "2026-11-03 00:00"],
        ["2026-11-03 00:00", "2026-11-03 01:00"],
      ]),
    ]);

    expect(summary(result)).toEqual(["2026-11-02 23:00-00:00 a", "2026-11-03 00:00-01:00 a"]);
  });

  test("日付はイベントのタイムゾーンで決める", () => {
    // UTC では 11/02 だが、JST では 11/03 の 8:00
    const result = summarizeAvailability(event, [
      {
        id: "a",
        name: "a",
        slots: [{ startAt: "2026-11-02T23:00:00.000Z", endAt: "2026-11-03T00:00:00.000Z", optionId: online }],
      },
    ]);

    expect(result[0].date).toBe("2026-11-03");
    expect(
      summarizeAvailability({ timezone: "UTC" }, [
        {
          id: "a",
          name: "a",
          slots: [{ startAt: "2026-11-02T23:00:00.000Z", endAt: "2026-11-03T00:00:00.000Z", optionId: online }],
        },
      ])[0].date,
    ).toBe("2026-11-02");
  });
});

describe("findCandidates", () => {
  const intervals = summarizeAvailability(event, [
    participant("a", [
      ["2026-11-02 10:00", "2026-11-02 12:00"],
      ["2026-11-03 10:00", "2026-11-03 10:15"],
    ]),
    participant("b", [
      ["2026-11-02 11:00", "2026-11-02 13:00"],
      ["2026-11-03 10:00", "2026-11-03 10:15"],
    ]),
    participant("c", [["2026-11-02 09:00", "2026-11-02 10:00"]]),
  ]);

  test("人数の多い順、同じ人数なら早い順に並べる", () => {
    expect(summary(findCandidates(intervals))).toEqual([
      "2026-11-02 11:00-12:00 a,b",
      "2026-11-02 09:00-10:00 c",
      "2026-11-02 10:00-11:00 a",
      "2026-11-02 12:00-13:00 b",
    ]);
  });

  test("短い区間を除く (既定は 30 分以上)", () => {
    expect(summary(findCandidates(intervals, { minDurationMinutes: 15 }))).toContain("2026-11-03 10:00-10:15 a,b");
    expect(summary(findCandidates(intervals))).not.toContain("2026-11-03 10:00-10:15 a,b");
  });

  test("人数の下限と件数の上限", () => {
    expect(summary(findCandidates(intervals, { minPeople: 2 }))).toEqual(["2026-11-02 11:00-12:00 a,b"]);
    expect(findCandidates(intervals, { limit: 2 })).toHaveLength(2);
  });
});
