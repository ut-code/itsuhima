import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/ja";

dayjs.locale("ja");

export type EditingMatrixSlot = {
  from: Date;
  to: Date;
  weight: number;
};

export type ViewingMatrixSlot = {
  from: Date;
  to: Date;
  weight: number;
  guestNames: string[];
};

/**
 * イベントのマージ計算用に、カレンダーを2次元行列で管理
 */
abstract class CalendarMatrixBase {
  protected matrix: number[][];
  /**
   * 15 分を 1 セルとしたセルの数 (96 = 24 * 4)
   */
  protected readonly quarterCount = 96;
  protected initialDate: Dayjs;

  constructor(dayCount: number, initialDate: Date) {
    this.matrix = Array.from({ length: dayCount }, () => Array.from({ length: this.quarterCount }, () => 0));
    this.initialDate = dayjs(initialDate).startOf("day");
  }

  protected getIndex(date: Date): [number, number] {
    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    const dayDiff = dayjs(date).startOf("day").diff(this.initialDate, "day");
    return [dayDiff, Math.floor(totalMinutes / 15)];
  }

  getIsSlotExist(date: Date): boolean {
    const [row, col] = this.getIndex(date);
    return this.matrix[row][col] !== 0;
  }

  abstract getSlots(): EditingMatrixSlot[] | ViewingMatrixSlot[];
  abstract clear(): void;
}

/**
 * 編集中イベントの {@link CalendarMatrixBase}
 */
export class EditingMatrix extends CalendarMatrixBase {
  setRange(from: Date, to: Date, newValue: number): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(dayjs(to).subtract(1, "minute").toDate());
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.matrix[r][c] = newValue;
      }
    }
  }

  getSlots(): EditingMatrixSlot[] {
    const slots: EditingMatrixSlot[] = [];
    for (let day = 0; day < this.matrix.length; day++) {
      const runs = findRuns(this.matrix[day], (a, b) => a === b);
      slots.push(...this.convertRunsToSlots(runs, day));
    }
    return slots;
  }

  private convertRunsToSlots(runs: { start: number; end: number; value: number }[], day: number): EditingMatrixSlot[] {
    return (
      runs
        // TODO: 値は null か非 null かで管理するようにしたい
        .filter((run) => run.value !== 0)
        .map((run) => {
          const from = this.initialDate
            .add(day, "day")
            .add(run.start * 15, "minute")
            .toDate();
          const to = this.initialDate
            .add(day, "day")
            .add(run.end * 15, "minute")
            .toDate();
          const weight = run.value;
          return { from, to, weight };
        })
    );
  }

  clear(): void {
    this.matrix = Array.from({ length: this.matrix.length }, () => Array.from({ length: this.quarterCount }, () => 0));
  }
}

/**
 * 閲覧中イベントの {@link CalendarMatrixBase}
 */
export class ViewingMatrix extends CalendarMatrixBase {
  private guestNames: string[][][];

  constructor(dayCount: number, initialDate: Date) {
    super(dayCount, initialDate);
    this.guestNames = Array.from({ length: dayCount }, () => Array.from({ length: this.quarterCount }, () => []));
  }

  incrementRange(from: Date, to: Date, guestName: string): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(dayjs(to).subtract(1, "minute").toDate());
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.matrix[r][c] += 1;
        this.guestNames[r][c].push(guestName);
      }
    }
  }

  getSlots(): ViewingMatrixSlot[] {
    const slots: ViewingMatrixSlot[] = [];
    for (let day = 0; day < this.matrix.length; day++) {
      const runs = findRuns(this.matrix[day], (a, b) => a === b);
      slots.push(...this.convertRunsToSlots(runs, day));
    }
    return slots;
  }

  private convertRunsToSlots(runs: { start: number; end: number; value: number }[], day: number): ViewingMatrixSlot[] {
    return runs
      // TODO: 値は null か非 null かで管理するようにしたい
      .filter((run) => run.value !== 0)
      .map((run) => {
        const from = this.initialDate
          .add(day, "day")
          .add(run.start * 15, "minute")
          .toDate();
        const to = this.initialDate
          .add(day, "day")
          .add(run.end * 15, "minute")
          .toDate();
        const weight = run.value;
        const guestNames = this.guestNames[day][run.start];
        return { from, to, weight, guestNames };
      });
  }

  clear(): void {
    this.matrix = Array.from({ length: this.matrix.length }, () => Array.from({ length: this.quarterCount }, () => 0));
    this.guestNames = Array.from({ length: this.matrix.length }, () =>
      Array.from({ length: this.quarterCount }, () => []),
    );
  }
}

/**
 * 配列から、同じ値が連続する区間 (run) を抽出して返す。null の区間は含まない。
 */
function findRuns<T>(array: ReadonlyArray<T | null>, isSame: (a: T, b: T) => boolean) {
  const runs: {
    start: number; // inclusive
    end: number; // exclusive
    value: T;
  }[] = [];

  let currentRun: {
    value: T;
    start: number;
  } | null = null;

  for (let i = 0; i <= array.length; i++) {
    // 番兵として、ループを 1 回余分に回し、その際の値は null とする
    const value = i < array.length ? array[i] : null;

    // 値が連続している場合は何もしない
    const isContinuation = currentRun && value !== null && isSame(currentRun.value, value);
    if (isContinuation) continue;

    // 値が変わっている場合は
    // 作成中の run があれば、その run を閉じる
    if (currentRun) {
      runs.push({
        start: currentRun.start,
        end: i,
        value: currentRun.value,
      });
    }
    // 新しい run の開始
    currentRun = value !== null ? { value, start: i } : null;
  }

  return runs;
}
