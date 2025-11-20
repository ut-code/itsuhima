import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/ja";

dayjs.locale("ja");

export type MatrixSlot = {
  from: Date;
  to: Date;
  weight: number;
  guestNames?: string[];
};

/**
 * イベントのマージ計算用に、カレンダーを2次元行列で管理
 */
export class CalendarMatrix {
  private matrix: number[][];
  private guestNames: string[][][] | null;
  /**
   * 15 分を 1 セルとしたセルの数 (96 = 24 * 4)
   */
  private readonly quarterCount = 96;
  private initialDate: Dayjs;

  constructor(dayCount: number, initialDate: Date, hasGuestNames?: boolean) {
    this.matrix = Array.from({ length: dayCount }, () => Array.from({ length: this.quarterCount }, () => 0));
    this.guestNames = hasGuestNames
      ? Array.from({ length: dayCount }, () => Array.from({ length: this.quarterCount }, () => []))
      : null;
    this.initialDate = dayjs(initialDate).startOf("day");
  }

  private getIndex(date: Date): [number, number] {
    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    const dayDiff = dayjs(date).startOf("day").diff(this.initialDate, "day");
    return [dayDiff, Math.floor(totalMinutes / 15)];
  }

  getIsSlotExist(date: Date): boolean {
    const [row, col] = this.getIndex(date);
    return this.matrix[row][col] !== 0;
  }

  getSlots(): MatrixSlot[] {
    const slots: MatrixSlot[] = [];
    for (let day = 0; day < this.matrix.length; day++) {
      let eventCount: number | null = null;
      let start: Date | null = null;
      let startGuestNames: string[] | null = null;
      for (let q = 0; q < this.matrix[day].length; q++) {
        const currentCell = this.matrix[day][q];
        if (eventCount !== currentCell) {
          if (start && eventCount !== null) {
            const from = start;
            const to = this.initialDate
              .add(day, "day")
              .add(q * 15, "minute")
              .toDate();
            const weight = eventCount;
            slots.push({ from, to, weight, guestNames: startGuestNames ?? undefined });
            start = null;
          }
          if (currentCell !== 0) {
            start = this.initialDate
              .add(day, "day")
              .add(q * 15, "minute")
              .toDate();
            startGuestNames = this.guestNames?.[day][q] ?? null;
          }
          eventCount = currentCell;
        }
      }
    }
    return slots;
  }

  setRange(from: Date, to: Date, newValue: number): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(dayjs(to).subtract(1, "minute").toDate());
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.matrix[r][c] = newValue;
      }
    }
  }

  incrementRange(from: Date, to: Date, guestName: string): void {
    const [startRow, startCol] = this.getIndex(from);
    const [endRow, endCol] = this.getIndex(dayjs(to).subtract(1, "minute").toDate());
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.matrix[r][c] += 1;
        if (this.guestNames) {
          this.guestNames[r][c].push(guestName);
        }
      }
    }
  }

  clear(): void {
    this.matrix = Array.from({ length: this.matrix.length }, () => Array.from({ length: this.quarterCount }, () => 0));
    this.guestNames = this.guestNames
      ? Array.from({ length: this.matrix.length }, () => Array.from({ length: this.quarterCount }, () => []))
      : null;
  }
}
