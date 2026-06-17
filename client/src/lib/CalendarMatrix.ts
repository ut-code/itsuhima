import type { Dayjs } from "../lib/dayjs";

export type EditingMatrixSlot = {
  from: Dayjs;
  to: Dayjs;
  optionId: string;
};

export type ViewingMatrixSlot = {
  from: Dayjs;
  to: Dayjs;
  guestIdToOptionId: Record<string, string>;
};

/**
 * イベントのマージ計算用に、カレンダーを2次元行列で管理
 */
abstract class CalendarMatrixBase<T> {
  protected matrix: (T | null)[][];
  /**
   * 15 分を 1 セルとしたセルの数 (96 = 24 * 4)
   */
  protected readonly quarterCount = 96;
  protected initialDatetime: Dayjs;

  constructor(dayCount: number, initialDate: Dayjs) {
    this.matrix = Array.from({ length: dayCount }, () => Array.from({ length: this.quarterCount }, () => null));
    this.initialDatetime = initialDate.startOf("day");
  }

  protected getIndex(dt: Dayjs): [number, number] {
    const totalMinutes = dt.hour() * 60 + dt.minute();
    const dayDiff = dt.startOf("day").diff(this.initialDatetime, "day");
    return [dayDiff, Math.floor(totalMinutes / 15)];
  }

  protected isInBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.matrix.length && col >= 0 && col < this.quarterCount;
  }

  getIsSlotExist(dt: Dayjs): boolean {
    const [row, col] = this.getIndex(dt);
    if (!this.isInBounds(row, col)) return false;
    return this.matrix[row][col] !== null;
  }

  setRange(from: Dayjs, to: Dayjs, newValue: T | null): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(to.subtract(1, "minute"));
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (!this.isInBounds(r, c)) continue;
        this.matrix[r][c] = newValue;
      }
    }
  }

  clear(): void {
    this.matrix = Array.from({ length: this.matrix.length }, () =>
      Array.from({ length: this.quarterCount }, () => null),
    );
  }
  abstract getSlots(): EditingMatrixSlot[] | ViewingMatrixSlot[];
}

/**
 * 編集中イベントの {@link CalendarMatrixBase}
 */
export class EditingMatrix extends CalendarMatrixBase<string> {
  getSlots(): EditingMatrixSlot[] {
    const slots: EditingMatrixSlot[] = [];
    for (let day = 0; day < this.matrix.length; day++) {
      const runs = findRuns(this.matrix[day], (a, b) => a === b);
      slots.push(...this.convertRunsToSlots(runs, day));
    }
    return slots;
  }

  private convertRunsToSlots(runs: { start: number; end: number; value: string }[], day: number): EditingMatrixSlot[] {
    return runs.map((run) => {
      const from = this.initialDatetime.add(day, "day").add(run.start * 15, "minute");
      const to = this.initialDatetime.add(day, "day").add(run.end * 15, "minute");
      const optionId = run.value;
      return { from, to, optionId };
    });
  }
}

/**
 * 閲覧中イベントの {@link CalendarMatrixBase}
 */
export class ViewingMatrix extends CalendarMatrixBase<Record<string, string>> {
  setGuestRange(from: Dayjs, to: Dayjs, guestId: string, optionId: string): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(to.subtract(1, "minute"));
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (!this.isInBounds(r, c)) continue;
        if (this.matrix[r][c] === null) {
          this.matrix[r][c] = {};
        }
        (this.matrix[r][c] as Record<string, string>)[guestId] = optionId;
      }
    }
  }

  getSlots(): ViewingMatrixSlot[] {
    const slots: ViewingMatrixSlot[] = [];
    for (let day = 0; day < this.matrix.length; day++) {
      const runs = findRuns(this.matrix[day], (a, b) => isSameRecordShallow(a, b));
      slots.push(...this.convertRunsToSlots(runs, day));
    }
    return slots;
  }

  private convertRunsToSlots(
    runs: { start: number; end: number; value: Record<string, string> }[],
    day: number,
  ): ViewingMatrixSlot[] {
    return runs.map((run) => {
      const from = this.initialDatetime.add(day, "day").add(run.start * 15, "minute");
      const to = this.initialDatetime.add(day, "day").add(run.end * 15, "minute");
      const guestIdToOptionId = run.value;
      return { from, to, guestIdToOptionId };
    });
  }
}

function isSameRecordShallow(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
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
