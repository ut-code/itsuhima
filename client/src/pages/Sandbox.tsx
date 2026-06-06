import { useEffect, useMemo, useRef, useState } from "react";
import { useLongPressDrag } from "../hooks/useLongPressDrag";
import { EditingMatrix, ViewingMatrix } from "../lib/CalendarMatrix";
import dayjs from "../lib/dayjs";

const START_DATE = dayjs().startOf("day");
const DAY_COUNT = 14;
const MIN_DAY_WIDTH = 56; // px per day column
const MIN_SLOT_HEIGHT = 14; // px per 15-min slot
const SLOT_START_HOUR = 9;
const SLOT_END_HOUR = 21;
const SLOT_COUNT = (SLOT_END_HOUR - SLOT_START_HOUR) * 4;
const GRID_HEIGHT = SLOT_COUNT * MIN_SLOT_HEIGHT; // 48 * 14 = 672px
const HEADER_HEIGHT = 40; // px — date header row
const TIME_COL_WIDTH = 40; // px — time label column
const INNER_WIDTH = TIME_COL_WIDTH + DAY_COUNT * MIN_DAY_WIDTH;
const OPTION_ID = "sandbox";
const OPACITY = 0.2;
const EDGE_ZONE = 60; // px from scroll edge to trigger auto-scroll
const MAX_SCROLL_SPEED = 8; // px per animation frame

// ダミーの参加形態
const VIEWING_OPTIONS = [
  { id: "opt-1", label: "対面", color: "#0F82B1" },
  { id: "opt-2", label: "オンライン", color: "#10B981" },
];

// ダミーのゲスト
const GUESTS: Record<string, string> = {
  "guest-1": "田中",
  "guest-2": "鈴木",
  "guest-3": "佐藤",
};

// ダミーの登録済みスロット
const DUMMY_VIEWING_SLOTS = [
  { guestId: "guest-1", optionId: "opt-1", from: START_DATE.hour(10), to: START_DATE.hour(12) },
  { guestId: "guest-2", optionId: "opt-1", from: START_DATE.hour(11), to: START_DATE.hour(13) },
  { guestId: "guest-3", optionId: "opt-2", from: START_DATE.hour(10), to: START_DATE.hour(11) },
  { guestId: "guest-1", optionId: "opt-2", from: START_DATE.add(1, "day").hour(10), to: START_DATE.add(1, "day").hour(12) },
  { guestId: "guest-2", optionId: "opt-1", from: START_DATE.add(1, "day").hour(10), to: START_DATE.add(1, "day").hour(11) },
  { guestId: "guest-3", optionId: "opt-1", from: START_DATE.add(2, "day").hour(14), to: START_DATE.add(2, "day").hour(16) },
  { guestId: "guest-1", optionId: "opt-1", from: START_DATE.add(2, "day").hour(14), to: START_DATE.add(2, "day").hour(15) },
];

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [Number.parseInt(result[1], 16), Number.parseInt(result[2], 16), Number.parseInt(result[3], 16)]
    : [15, 130, 177];
}

type Preview = {
  fromDay: number;
  fromSlot: number;
  toDay: number;
  toSlot: number;
  isDeletion: boolean;
};

export default function SandboxPage() {
  const matrixRef = useRef(new EditingMatrix(DAY_COUNT, START_DATE));
  const [slots, setSlots] = useState(() => matrixRef.current.getSlots());
  const [preview, setPreview] = useState<Preview | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ day: number; slot: number } | null>(null);
  const isDeletion = useRef(false);
  const previewRef = useRef<Preview | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const updatePreviewRef = useRef<(x: number, y: number) => void>(() => {});

  // ViewingMatrix をダミーデータで初期化（静的なので一度だけ）
  const viewingSlots = useMemo(() => {
    const matrix = new ViewingMatrix(DAY_COUNT, START_DATE);
    for (const s of DUMMY_VIEWING_SLOTS) {
      matrix.setGuestRange(s.from, s.to, s.guestId, s.optionId);
    }
    return matrix.getSlots();
  }, []);

  const xyToCell = (x: number, y: number) => {
    const el = gridRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      day: Math.min(Math.max(Math.floor(((x - r.left) / r.width) * DAY_COUNT), 0), DAY_COUNT - 1),
      slot: Math.min(Math.max(Math.floor(((y - r.top) / r.height) * SLOT_COUNT), 0), SLOT_COUNT - 1),
    };
  };

  const cellToDayjs = (day: number, slot: number) =>
    START_DATE.add(day, "day")
      .hour(SLOT_START_HOUR)
      .minute(0)
      .add(slot * 15, "minute");

  // 毎レンダーで最新のクロージャに更新される。auto-scroll ループから呼び出す。
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
      if (!sc) { autoScrollRef.current = null; return; }
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

  // アンマウント時に rAF をキャンセル
  useEffect(() => {
    return () => {
      const id = autoScrollRef.current;
      if (id !== null) cancelAnimationFrame(id);
      autoScrollRef.current = null;
    };
  }, []);

  useLongPressDrag(gridRef, {
    onStart: (x, y) => {
      const cell = xyToCell(x, y);
      if (!cell) return;
      isDeletion.current = matrixRef.current.getIsSlotExist(cellToDayjs(cell.day, cell.slot));
      dragStart.current = cell;
      scrollRef.current?.classList.add("scrollbar-hidden");
    },
    onMove: (x, y) => {
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
      const p = previewRef.current ?? (dragStart.current
        ? { fromDay: dragStart.current.day, fromSlot: dragStart.current.slot, toDay: dragStart.current.day, toSlot: dragStart.current.slot, isDeletion: isDeletion.current }
        : null);
      if (p) {
        for (let d = p.fromDay; d <= p.toDay; d++) {
          matrixRef.current.setRange(
            cellToDayjs(d, p.fromSlot),
            cellToDayjs(d, p.toSlot + 1),
            isDeletion.current ? null : OPTION_ID,
          );
        }
        setSlots(matrixRef.current.getSlots());
        previewRef.current = null;
        setPreview(null);
      }
      dragStart.current = null;
    },
  });

  // セルインデックス → CSS パーセント位置
  const pct = (fromDay: number, fromSlot: number, daySpan: number, slotSpan: number) => ({
    left: `${(fromDay / DAY_COUNT) * 100}%`,
    top: `${(fromSlot / SLOT_COUNT) * 100}%`,
    width: `${(daySpan / DAY_COUNT) * 100}%`,
    height: `${(slotSpan / SLOT_COUNT) * 100}%`,
  });

  // Dayjs → グリッド内スロットインデックス
  const toSlotIdx = (dt: ReturnType<typeof dayjs>) =>
    (dt.hour() - SLOT_START_HOUR) * 4 + dt.minute() / 15;

  return (
    <div className="flex h-dvh flex-col p-4">
      <h1 className="mb-1 font-bold">カレンダー サンドボックス</h1>

      {/* 凡例 */}
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-gray-600">
        {VIEWING_OPTIONS.map((opt) => (
          <span key={opt.id} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: opt.color }} />
            {opt.label}
          </span>
        ))}
        <span className="text-gray-400">
          参加者: {Object.values(GUESTS).join(" / ")}
        </span>
      </div>

      {/*
        単一スクロールコンテナ（縦横両対応）。
        内部の日付ヘッダーは sticky top-0、時刻ラベル列は sticky left-0 で固定。
      */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-none">
        <div style={{ width: `${INNER_WIDTH}px` }}>

          {/*
            コーナーオーバーレイ: 縦横どちらにスクロールしても左上に固定。
            inner div の直接の子にすることで z-20 がスタッキングコンテキストを
            跨がず日付ヘッダー(z-10)・時刻ラベル(z-10) 両方を覆う。
            marginBottom で後続の日付ヘッダーのレイアウト位置を変えない。
          */}
          <div
            className="sticky left-0 top-0 z-20 bg-white"
            style={{ width: `${TIME_COL_WIDTH}px`, height: `${HEADER_HEIGHT}px`, marginBottom: `-${HEADER_HEIGHT}px` }}
          />

          {/* 日付ヘッダー行（sticky: 縦スクロール時に上部固定） */}
          <div
            className="sticky top-0 z-10 flex bg-white"
            style={{ height: `${HEADER_HEIGHT}px` }}
          >
            {/* コーナーオーバーレイに隠れる部分のレイアウトスペーサー */}
            <div className="shrink-0" style={{ width: `${TIME_COL_WIDTH}px` }} />
            <div className="flex flex-1">
              {Array.from({ length: DAY_COUNT }, (_, i) => {
                const d = START_DATE.add(i, "day");
                return (
                  <div key={d.format("YYYY-MM-DD")} className="flex flex-1 flex-col items-center justify-center text-[11px] text-gray-600">
                    <span>{d.format("M/D")}</span>
                    <span>{d.format("(ddd)")}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* コンテンツ行: 時刻ラベル + グリッド本体（mt-2 で 9:00 ラベルの上半分を確保） */}
          <div className="mt-2 flex" style={{ height: `${GRID_HEIGHT}px` }}>

            {/* 時刻ラベル列（sticky: 横スクロール時に左端固定） */}
            <div
              className="sticky left-0 z-10 shrink-0 bg-white"
              style={{ width: `${TIME_COL_WIDTH}px` }}
            >
              <div className="relative h-full">
                {Array.from({ length: (SLOT_END_HOUR - SLOT_START_HOUR) * 2 + 1 }, (_, i) => {
                  const hour = SLOT_START_HOUR + Math.floor(i / 2);
                  const min = i % 2 === 0 ? "00" : "30";
                  return (
                    <div
                      key={`${hour}:${min}`}
                      className="-translate-y-1/2 absolute right-1 text-right text-[10px] text-gray-400"
                      style={{ top: `${((i * 2) / SLOT_COUNT) * 100}%` }}
                    >
                      {`${hour}:${min}`}
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
                  `100% calc(200% / ${SLOT_COUNT})`,
                  `100% calc(100% / ${SLOT_COUNT})`,
                  `calc(100% / ${DAY_COUNT}) 100%`,
                ].join(", "),
              }}
            >
              {/* 枠線オーバーレイ: ring/border を使わずコンテンツエリアへの影響を防ぐ */}
              <div className="absolute inset-0 border border-gray-200 pointer-events-none" />

              {/* 閲覧スロット（他人のイベント） */}
              {viewingSlots.map((slot) => {
                const dayIdx = slot.from.startOf("day").diff(START_DATE, "day");
                const fromSlot = toSlotIdx(slot.from);
                const toSlot = toSlotIdx(slot.to);
                if (dayIdx < 0 || dayIdx >= DAY_COUNT || fromSlot < 0 || toSlot <= fromSlot) return null;

                // 参加形態ごとにゲストをグループ化
                const optionGroups = new Map<string, string[]>();
                for (const [guestId, optionId] of Object.entries(slot.guestIdToOptionId)) {
                  const group = optionGroups.get(optionId);
                  if (group) {
                    group.push(guestId);
                  } else {
                    optionGroups.set(optionId, [guestId]);
                  }
                }

                // VIEWING_OPTIONS の順番でブレークダウンを作成
                const breakdown = VIEWING_OPTIONS.filter((opt) => optionGroups.has(opt.id)).map((opt) => {
                  const guestIds = optionGroups.get(opt.id) ?? [];
                  const opacity = 1 - (1 - OPACITY) ** guestIds.length;
                  return { ...opt, guestIds, opacity };
                });

                // 背景スタイル: 単色 or グラデーション
                let background: string;
                if (breakdown.length === 1) {
                  const [r, g, b] = hexToRgb(breakdown[0].color);
                  background = `rgba(${r},${g},${b},${breakdown[0].opacity})`;
                } else {
                  const w = 100 / breakdown.length;
                  const stops = breakdown
                    .map((bd, j) => {
                      const [r, g, b] = hexToRgb(bd.color);
                      return `rgba(${r},${g},${b},${bd.opacity}) ${j * w}%, rgba(${r},${g},${b},${bd.opacity}) ${(j + 1) * w}%`;
                    })
                    .join(", ");
                  background = `linear-gradient(90deg, ${stops})`;
                }

                return (
                  <div
                    key={`vs-${slot.from.valueOf()}`}
                    className="pointer-events-none absolute"
                    style={{ ...pct(dayIdx, fromSlot, 1, toSlot - fromSlot), background }}
                  >
                    {/* 参加形態ごとにバッジをその色帯の中央に配置 */}
                    <div className="relative h-full w-full">
                      {breakdown.map((bd, j) => {
                        const position = ((j + 0.5) / breakdown.length) * 100;
                        return (
                          <div
                            key={bd.id}
                            className="absolute top-1/2"
                            style={{ left: `${position}%`, transform: "translate(-50%, -50%)" }}
                          >
                            <span
                              className="rounded bg-gray-200 px-1 text-[10px] font-bold leading-4"
                              style={{ color: bd.color }}
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

              {/* 編集中スロット（自分のイベント） */}
              {slots.map((slot) => {
                const dayIdx = slot.from.startOf("day").diff(START_DATE, "day");
                const fromSlot = toSlotIdx(slot.from);
                const toSlot = toSlotIdx(slot.to);
                return (
                  <div
                    key={`es-${slot.from.valueOf()}`}
                    className="pointer-events-none absolute border border-[#0F82B1]"
                    style={{ ...pct(dayIdx, fromSlot, 1, toSlot - fromSlot), backgroundColor: "#0F82B133" }}
                  />
                );
              })}

              {/* ドラッグ中プレビュー */}
              {preview && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed"
                  style={{
                    ...pct(
                      preview.fromDay,
                      preview.fromSlot,
                      preview.toDay - preview.fromDay + 1,
                      preview.toSlot - preview.fromSlot + 1,
                    ),
                    backgroundColor: preview.isDeletion ? "rgba(239,68,68,0.15)" : "rgba(15,130,177,0.15)",
                    borderColor: preview.isDeletion ? "#ef4444" : "#0F82B1",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
