import { describe, expect, test } from "vitest";
import { ServiceError } from "../src/services/errors.js";
import { validateSlots } from "../src/services/slots.js";

// 2026/11/02〜11/04 (JST)、08:00〜23:00 のイベント。時刻はコメントに JST で書く
const project = {
  timezone: "Asia/Tokyo",
  startDate: new Date("2026-11-01T15:00:00.000Z"),
  endDate: new Date("2026-11-04T14:59:59.999Z"),
  allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
  participationOptions: [{ id: "option" }],
};
const allDayProject = { ...project, allowedRanges: [] };

function slot(start: string, end: string, participationOptionId = "option") {
  return { start: new Date(start), end: new Date(end), participationOptionId };
}

function validationError(fn: () => void): ServiceError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ServiceError) return err;
    throw err;
  }
  throw new Error("ServiceError が投げられませんでした");
}

describe("validateSlots", () => {
  test("期間と時間帯に収まる Slot は通す", () => {
    expect(() =>
      validateSlots(project, [
        // 11/02 08:00〜10:00 (初日、時間帯の始まりちょうどから)
        slot("2026-11-01T23:00:00.000Z", "2026-11-02T01:00:00.000Z"),
        // 11/04 21:00〜23:00 (最終日、時間帯の終わりちょうどまで)
        slot("2026-11-04T12:00:00.000Z", "2026-11-04T14:00:00.000Z"),
      ]),
    ).not.toThrow();
  });

  test("Slot が 0 件なら通す", () => {
    expect(() => validateSlots(project, [])).not.toThrow();
  });

  test("期間の前日と翌日は弾く", () => {
    // 11/01 10:00〜12:00
    const before = validationError(() =>
      validateSlots(project, [slot("2026-11-01T01:00:00.000Z", "2026-11-01T03:00:00.000Z")]),
    );
    // 11/05 10:00〜12:00
    const after = validationError(() =>
      validateSlots(project, [slot("2026-11-05T01:00:00.000Z", "2026-11-05T03:00:00.000Z")]),
    );

    expect(before.reason).toBe("invalid_slot");
    expect(before.message).toBe("1 件目の時間帯: イベントの日程の範囲 (2026-11-02〜2026-11-04) の外です。");
    expect(after.reason).toBe("invalid_slot");
  });

  test("時間帯より前に始まる Slot は弾く", () => {
    // 11/02 07:45〜09:00
    const err = validationError(() =>
      validateSlots(project, [slot("2026-11-01T22:45:00.000Z", "2026-11-02T00:00:00.000Z")]),
    );

    expect(err.message).toBe("1 件目の時間帯: イベントの時間帯 (08:00〜23:00) の外です。");
  });

  test("時間帯より後に終わる Slot は弾く", () => {
    // 11/02 22:00〜23:15
    const err = validationError(() =>
      validateSlots(project, [slot("2026-11-02T13:00:00.000Z", "2026-11-02T14:15:00.000Z")]),
    );

    expect(err.reason).toBe("invalid_slot");
  });

  test("15 分単位でない Slot は弾く", () => {
    // 11/02 10:10〜12:00
    const minutes = validationError(() =>
      validateSlots(project, [slot("2026-11-02T01:10:00.000Z", "2026-11-02T03:00:00.000Z")]),
    );
    // 11/02 10:00:30〜12:00
    const seconds = validationError(() =>
      validateSlots(project, [slot("2026-11-02T01:00:30.000Z", "2026-11-02T03:00:00.000Z")]),
    );

    expect(minutes.reason).toBe("invalid_slot");
    expect(seconds.reason).toBe("invalid_slot");
  });

  test("開始が終了より前でない Slot は弾く", () => {
    // 11/02 12:00〜12:00
    const empty = validationError(() =>
      validateSlots(project, [slot("2026-11-02T03:00:00.000Z", "2026-11-02T03:00:00.000Z")]),
    );
    // 11/02 12:00〜10:00
    const reversed = validationError(() =>
      validateSlots(project, [slot("2026-11-02T03:00:00.000Z", "2026-11-02T01:00:00.000Z")]),
    );

    expect(empty.reason).toBe("invalid_slot");
    expect(reversed.reason).toBe("invalid_slot");
  });

  test("日をまたぐ Slot は弾く", () => {
    // 11/02 23:00〜11/03 01:00
    const err = validationError(() =>
      validateSlots(allDayProject, [slot("2026-11-02T14:00:00.000Z", "2026-11-02T16:00:00.000Z")]),
    );

    expect(err.message).toBe("1 件目の時間帯: 日をまたいでいます。日付ごとに分けてください。");
  });

  // 時間帯が無いと、カレンダーは 23:45〜24:00 のセルを描画し、終わりを翌日の 0:00 として送る
  test("時間帯が無ければ終日とみなし、最終日の 23:45〜24:00 も通す", () => {
    expect(() =>
      validateSlots(allDayProject, [
        // 11/02 00:00〜01:00
        slot("2026-11-01T15:00:00.000Z", "2026-11-01T16:00:00.000Z"),
        // 11/04 23:45〜11/05 00:00
        slot("2026-11-04T14:45:00.000Z", "2026-11-04T15:00:00.000Z"),
      ]),
    ).not.toThrow();
  });

  test("日付はイベントのタイムゾーンで判定する", () => {
    // JST では 11/03 08:30〜09:30 だが、UTC では 11/02 23:30〜11/03 00:30 で日をまたぐ
    const target = slot("2026-11-02T23:30:00.000Z", "2026-11-03T00:30:00.000Z");

    expect(() => validateSlots(allDayProject, [target])).not.toThrow();
    expect(validationError(() => validateSlots({ ...allDayProject, timezone: "UTC" }, [target])).message).toBe(
      "1 件目の時間帯: 日をまたいでいます。日付ごとに分けてください。",
    );
  });

  test("イベントに無い参加形態は弾く", () => {
    const err = validationError(() =>
      validateSlots(project, [slot("2026-11-02T01:00:00.000Z", "2026-11-02T03:00:00.000Z", "other")]),
    );

    expect(err.message).toBe("1 件目の時間帯: このイベントに無い参加形態です。");
  });

  test("何件目の Slot が違反したかをメッセージに含める", () => {
    const err = validationError(() =>
      validateSlots(project, [
        // 11/02 10:00〜12:00
        slot("2026-11-02T01:00:00.000Z", "2026-11-02T03:00:00.000Z"),
        // 11/01 10:00〜12:00
        slot("2026-11-01T01:00:00.000Z", "2026-11-01T03:00:00.000Z"),
      ]),
    );

    expect(err.message).toMatch(/^2 件目の時間帯: /);
  });
});
