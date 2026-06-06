import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "react-tooltip";
import { useLongPressDrag } from "../hooks/useLongPressDrag";
import { EditingMatrix, ViewingMatrix } from "../lib/CalendarMatrix";
import type { Dayjs } from "../lib/dayjs";
import type { EditingSlot } from "../pages/eventId/Submission";

type AllowedRange = {
  startTime: Dayjs;
  endTime: Dayjs;
};

type ViewingSlot = {
  from: Dayjs;
  to: Dayjs;
  guestId: string;
  optionId: string;
};

type ParticipationOption = {
  id: string;
  label: string;
  color: string;
};

type Props = {
  startDate: Dayjs;
  endDate: Dayjs;
  allowedRanges: AllowedRange[];
  editingSlots: EditingSlot[];
  viewingSlots: ViewingSlot[];
  guestIdToName: Record<string, string>;
  guestIdToComment: Record<string, string>;
  participationOptions: ParticipationOption[];
  currentParticipationOptionId: string;
  editMode: boolean;
  onChangeEditingSlots: (slots: EditingSlot[]) => void;
};

type Preview = {
  fromDay: number;
  fromSlot: number;
  toDay: number;
  toSlot: number;
  isDeletion: boolean;
};

const MIN_DAY_WIDTH = 56;
const MIN_SLOT_HEIGHT = 14;
const HEADER_HEIGHT = 40;
const TIME_COL_WIDTH = 40;
const EDGE_ZONE = 60;
const MAX_SCROLL_SPEED = 8;
const OPACITY = 0.2;
const PRIMARY_RGB: [number, number, number] = [15, 130, 177];

// TODO: colors.ts のものと共通化
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [Number.parseInt(result[1], 16), Number.parseInt(result[2], 16), Number.parseInt(result[3], 16)]
    : PRIMARY_RGB;
}

export const Calendar = ({
  startDate,
  endDate,
  allowedRanges,
  editingSlots,
  viewingSlots,
  guestIdToName,
  guestIdToComment,
  participationOptions,
  currentParticipationOptionId,
  editMode,
  onChangeEditingSlots,
}: Props) => {
  const countDays = endDate.startOf("day").diff(startDate.startOf("day"), "day") + 1;

  const allowedRange = allowedRanges[0] ?? {
    startTime: startDate.startOf("day"),
    endTime: startDate.startOf("day").add(23, "hour").add(59, "minute"),
  };
  const slotStartMinutes = allowedRange.startTime.hour() * 60 + allowedRange.startTime.minute();
  const slotEndMinutes = allowedRange.endTime.hour() * 60 + allowedRange.endTime.minute();
  const slotCount = Math.ceil((slotEndMinutes - slotStartMinutes) / 15);

  const gridHeight = slotCount * MIN_SLOT_HEIGHT;
  const innerWidth = TIME_COL_WIDTH + countDays * MIN_DAY_WIDTH;

  const editingMatrixRef = useRef(new EditingMatrix(countDays, startDate));
  const [slots, setSlots] = useState(() => editingMatrixRef.current.getSlots());
  const [preview, setPreview] = useState<Preview | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ day: number; slot: number } | null>(null);
  const isDeletion = useRef(false);
  const previewRef = useRef<Preview | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const updatePreviewRef = useRef<(x: number, y: number) => void>(() => {});

  // editingSlots prop → matrix → local state
  useEffect(() => {
    editingMatrixRef.current.clear();
    for (const slot of editingSlots) {
      editingMatrixRef.current.setRange(slot.from, slot.to, slot.participationOptionId);
    }
    setSlots(editingMatrixRef.current.getSlots());
  }, [editingSlots]);

  // viewingSlots → ViewingMatrix → rendered slots
  const computedViewingSlots = useMemo(() => {
    const matrix = new ViewingMatrix(countDays, startDate);
    for (const slot of viewingSlots) {
      matrix.setGuestRange(slot.from, slot.to, slot.guestId, slot.optionId);
    }
    return matrix.getSlots();
  }, [viewingSlots, countDays, startDate]);

  // セル座標変換ヘルパー（毎レンダーで最新クロージャを利用）
  const xyToCell = (x: number, y: number) => {
    const el = gridRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      day: Math.min(Math.max(Math.floor(((x - r.left) / r.width) * countDays), 0), countDays - 1),
      slot: Math.min(Math.max(Math.floor(((y - r.top) / r.height) * slotCount), 0), slotCount - 1),
    };
  };

  const cellToDayjs = (day: number, slot: number) =>
    startDate
      .startOf("day")
      .add(day, "day")
      .add(slotStartMinutes + slot * 15, "minute");

  const toSlotIdx = (dt: Dayjs) => (dt.hour() * 60 + dt.minute() - slotStartMinutes) / 15;

  updatePreviewRef.current = (x: number, y: number) => {
    const cell = xyToCell(x, y);
    const s = dragStart.current;
    if (!cell || !s) return;
    const p: Preview = {
      fromDay: Math.min(s.day, cell.day),
      fromSlot: Math.min(s.slot, cell.slot),
      toDay: Math.max(s.day, cell.day),
      toSlot: Math.max(s.slot, cell.slot),
      isDeletion: isDeletion.current,
    };
    previewRef.current = p;
    setPreview(p);
  };

  const stopAutoScroll = () => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };

  const startAutoScroll = () => {
    if (autoScrollRef.current !== null) return;
    const loop = () => {
      const sc = scrollRef.current;
      if (!sc) {
        autoScrollRef.current = null;
        return;
      }
      const { left, right, top, bottom } = sc.getBoundingClientRect();
      const x = pointerXRef.current;
      const y = pointerYRef.current;
      let scrolled = false;
      if (x < left + EDGE_ZONE) {
        sc.scrollLeft -= ((left + EDGE_ZONE - x) / EDGE_ZONE) * MAX_SCROLL_SPEED;
        scrolled = true;
      } else if (x > right - EDGE_ZONE) {
        sc.scrollLeft += ((x - (right - EDGE_ZONE)) / EDGE_ZONE) * MAX_SCROLL_SPEED;
        scrolled = true;
      }
      if (y < top + EDGE_ZONE) {
        sc.scrollTop -= ((top + EDGE_ZONE - y) / EDGE_ZONE) * MAX_SCROLL_SPEED;
        scrolled = true;
      } else if (y > bottom - EDGE_ZONE) {
        sc.scrollTop += ((y - (bottom - EDGE_ZONE)) / EDGE_ZONE) * MAX_SCROLL_SPEED;
        scrolled = true;
      }
      if (scrolled) {
        updatePreviewRef.current(pointerXRef.current, pointerYRef.current);
        autoScrollRef.current = requestAnimationFrame(loop);
      } else {
        autoScrollRef.current = null;
      }
    };
    autoScrollRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    return () => {
      const id = autoScrollRef.current;
      if (id !== null) cancelAnimationFrame(id);
      autoScrollRef.current = null;
    };
  }, []);

  useLongPressDrag(gridRef, {
    onStart: (x, y) => {
      if (!editMode) return;
      const cell = xyToCell(x, y);
      if (!cell) return;
      isDeletion.current = editingMatrixRef.current.getIsSlotExist(cellToDayjs(cell.day, cell.slot));
      dragStart.current = cell;
      scrollRef.current?.classList.add("scrollbar-hidden");
    },
    onMove: (x, y) => {
      if (!dragStart.current) return;
      pointerXRef.current = x;
      pointerYRef.current = y;
      updatePreviewRef.current(x, y);
      const sc = scrollRef.current;
      if (sc) {
        const { left, right, top, bottom } = sc.getBoundingClientRect();
        if (x < left + EDGE_ZONE || x > right - EDGE_ZONE || y < top + EDGE_ZONE || y > bottom - EDGE_ZONE) {
          startAutoScroll();
        }
      }
    },
    onEnd: () => {
      stopAutoScroll();
      scrollRef.current?.classList.remove("scrollbar-hidden");
      const p =
        previewRef.current ??
        (dragStart.current
          ? {
              fromDay: dragStart.current.day,
              fromSlot: dragStart.current.slot,
              toDay: dragStart.current.day,
              toSlot: dragStart.current.slot,
              isDeletion: isDeletion.current,
            }
          : null);
      if (p) {
        for (let d = p.fromDay; d <= p.toDay; d++) {
          editingMatrixRef.current.setRange(
            cellToDayjs(d, p.fromSlot),
            cellToDayjs(d, p.toSlot + 1),
            isDeletion.current ? null : currentParticipationOptionId,
          );
        }
        const newSlots = editingMatrixRef.current.getSlots().map((slot) => ({
          from: slot.from,
          to: slot.to,
          participationOptionId: slot.optionId,
        }));
        onChangeEditingSlots(newSlots);
        previewRef.current = null;
        setPreview(null);
      }
      dragStart.current = null;
    },
  });

  const pct = (fromDay: number, fromSlot: number, daySpan: number, slotSpan: number) => ({
    left: `${(fromDay / countDays) * 100}%`,
    top: `${(fromSlot / slotCount) * 100}%`,
    width: `${(daySpan / countDays) * 100}%`,
    height: `${(slotSpan / slotCount) * 100}%`,
  });

  const currentOption = participationOptions.find((o) => o.id === currentParticipationOptionId);
  const currentColor = currentOption?.color ?? `rgb(${PRIMARY_RGB.join(",")})`;

  const halfHourCount = Math.floor((slotEndMinutes - slotStartMinutes) / 30) + 1;

  return (
    <div className="my-2 min-h-0 flex-1 overflow-auto overscroll-none bg-white" ref={scrollRef}>
      <div style={{ minWidth: `${innerWidth}px`, width: "100%" }}>
        {/* コーナーオーバーレイ: 縦横どちらにスクロールしても左上に固定 */}
        <div
          className="sticky top-0 left-0 z-20 bg-white"
          style={{ width: `${TIME_COL_WIDTH}px`, height: `${HEADER_HEIGHT}px`, marginBottom: `-${HEADER_HEIGHT}px` }}
        />

        {/* 日付ヘッダー行（sticky: 縦スクロール時に上部固定） */}
        <div className="sticky top-0 z-10 flex bg-white" style={{ height: `${HEADER_HEIGHT}px` }}>
          <div className="shrink-0" style={{ width: `${TIME_COL_WIDTH}px` }} />
          <div className="flex flex-1">
            {Array.from({ length: countDays }, (_, i) => {
              const d = startDate.add(i, "day");
              return (
                <div
                  key={d.format("YYYY-MM-DD")}
                  className="flex flex-1 flex-col items-center justify-center text-[11px] text-gray-600"
                >
                  <span>{d.format("M/D")}</span>
                  <span>{d.format("(ddd)")}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* コンテンツ行: 時刻ラベル + グリッド本体 */}
        <div className="mt-2 flex" style={{ height: `${gridHeight}px` }}>
          {/* 時刻ラベル列（sticky: 横スクロール時に左端固定） */}
          <div className="sticky left-0 z-10 shrink-0 bg-white" style={{ width: `${TIME_COL_WIDTH}px` }}>
            <div className="relative h-full">
              {Array.from({ length: halfHourCount }, (_, i) => {
                const totalMin = slotStartMinutes + i * 30;
                const hour = Math.floor(totalMin / 60);
                const min = totalMin % 60;
                return (
                  <div
                    key={`${hour}:${min}`}
                    className="-translate-y-1/2 absolute right-1 text-right text-[10px] text-gray-400"
                    style={{ top: `${((i * 2) / slotCount) * 100}%` }}
                  >
                    {`${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`}
                  </div>
                );
              })}
            </div>
          </div>

          {/* グリッド本体 */}
          <div
            ref={gridRef}
            className="relative flex-1 select-none overflow-hidden"
            style={{
              backgroundImage: [
                "linear-gradient(to bottom, #d1d5db 1px, transparent 1px)",
                "linear-gradient(to bottom, #f3f4f6 1px, transparent 1px)",
                "linear-gradient(to right, #e5e7eb 1px, transparent 1px)",
              ].join(", "),
              backgroundSize: [
                `100% calc(200% / ${slotCount})`,
                `100% calc(100% / ${slotCount})`,
                `calc(100% / ${countDays}) 100%`,
              ].join(", "),
            }}
          >
            <div className="pointer-events-none absolute inset-0 border border-gray-200" />

            {/* 閲覧スロット（他ゲストの登録済み時間） */}
            {computedViewingSlots.map((slot) => {
              const dayIdx = slot.from.startOf("day").diff(startDate.startOf("day"), "day");
              const fromSlot = toSlotIdx(slot.from);
              const toSlot = toSlotIdx(slot.to);
              if (dayIdx < 0 || dayIdx >= countDays || fromSlot < 0 || toSlot <= fromSlot) return null;

              const optionGroups = new Map<string, string[]>();
              for (const [guestId, optionId] of Object.entries(slot.guestIdToOptionId)) {
                const group = optionGroups.get(optionId);
                if (group) {
                  group.push(guestId);
                } else {
                  optionGroups.set(optionId, [guestId]);
                }
              }

              const breakdown = participationOptions
                .filter((opt) => optionGroups.has(opt.id))
                .map((opt) => {
                  const guestIds = optionGroups.get(opt.id) ?? [];
                  const opacity = 1 - (1 - OPACITY) ** guestIds.length;
                  return { ...opt, guestIds, opacity };
                });

              let background: string;
              if (breakdown.length === 1) {
                const [r, g, b] = hexToRgb(breakdown[0].color);
                background = `rgba(${r},${g},${b},${breakdown[0].opacity.toFixed(3)})`;
              } else if (breakdown.length > 1) {
                const w = 100 / breakdown.length;
                const stops = breakdown
                  .map((bd, j) => {
                    const [r, g, b] = hexToRgb(bd.color);
                    return `rgba(${r},${g},${b},${bd.opacity.toFixed(3)}) ${j * w}%, rgba(${r},${g},${b},${bd.opacity.toFixed(3)}) ${(j + 1) * w}%`;
                  })
                  .join(", ");
                background = `linear-gradient(90deg, ${stops})`;
              } else {
                const [r, g, b] = PRIMARY_RGB;
                background = `rgba(${r},${g},${b},${OPACITY})`;
              }

              return (
                <div
                  key={`vs-${slot.from.valueOf()}`}
                  className="pointer-events-none absolute"
                  style={{ ...pct(dayIdx, fromSlot, 1, toSlot - fromSlot), background }}
                >
                  <div className="relative h-full w-full">
                    {breakdown.map((bd, j) => {
                      const position = ((j + 0.5) / breakdown.length) * 100;
                      const tooltipContent = `
                        <div>
                          <div style="font-weight:bold;margin-bottom:4px;color:${bd.color}">${bd.label}</div>
                          <ul style="margin:0;padding-left:1.2rem;list-style-type:disc">
                            ${bd.guestIds
                              .map((guestId) => {
                                const name = guestIdToName[guestId] ?? guestId;
                                return `<li>${guestIdToComment[guestId] ? `${name} 💬` : name}</li>`;
                              })
                              .join("")}
                          </ul>
                        </div>
                      `;
                      return (
                        <div
                          key={bd.id}
                          className="pointer-events-auto absolute top-1/2"
                          style={{ left: `${position}%`, transform: "translate(-50%, -50%)" }}
                        >
                          <span
                            className="badge sm:badge-sm h-4 min-h-0 border-0 bg-gray-200 px-1 py-0 font-bold text-[10px] sm:h-5 sm:px-2 sm:text-sm"
                            style={{ color: bd.color }}
                            data-tooltip-id="member-info"
                            data-tooltip-html={tooltipContent}
                            data-tooltip-place="top"
                          >
                            {bd.guestIds.length}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* 編集中スロット（自分の登録済み時間） */}
            {slots.map((slot) => {
              const dayIdx = slot.from.startOf("day").diff(startDate.startOf("day"), "day");
              const fromSlot = toSlotIdx(slot.from);
              const toSlot = toSlotIdx(slot.to);
              if (dayIdx < 0 || dayIdx >= countDays) return null;

              const option = participationOptions.find((o) => o.id === slot.optionId);
              const color = option?.color ?? `rgb(${PRIMARY_RGB.join(",")})`;
              const [r, g, b] = hexToRgb(color);

              return (
                <div
                  key={`es-${slot.from.valueOf()}`}
                  className="pointer-events-none absolute"
                  style={{
                    ...pct(dayIdx, fromSlot, 1, toSlot - fromSlot),
                    backgroundColor: `rgba(${r},${g},${b},${OPACITY})`,
                    border: `1px solid ${color}`,
                  }}
                />
              );
            })}

            {/* ドラッグ中プレビュー */}
            {preview &&
              (() => {
                const [r, g, b] = preview.isDeletion ? [239, 68, 68] : hexToRgb(currentColor);
                return (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed"
                    style={{
                      ...pct(
                        preview.fromDay,
                        preview.fromSlot,
                        preview.toDay - preview.fromDay + 1,
                        preview.toSlot - preview.fromSlot + 1,
                      ),
                      backgroundColor: `rgba(${r},${g},${b},0.15)`,
                      borderColor: preview.isDeletion ? "#ef4444" : currentColor,
                    }}
                  />
                );
              })()}
          </div>
        </div>
      </div>
      <Tooltip
        id="member-info"
        style={{
          backgroundColor: "#fff",
          color: "#666",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
        }}
      />
    </div>
  );
};
