import { type RefObject, useEffect, useRef } from "react";

type Callbacks = {
  onStart: (x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
};

/**
 * グリッド上でのドラッグ操作を管理するフック。
 *
 * タッチ: LONG_PRESS_DELAY ms 静止後にドラッグ開始。それ以前に動いた場合はスクロールとして扱う。
 * マウス: mousedown で即座にドラッグ開始。
 *
 * touchmove を passive:false で登録することで、ドラッグ確定後のみ preventDefault() でスクロールを抑制する。
 */
export function useLongPressDrag(
  ref: RefObject<HTMLElement | null>,
  callbacks: Callbacks,
  { delay = 150, moveThreshold = 5 }: { delay?: number; moveThreshold?: number } = {},
) {
  const cb = useRef(callbacks);
  cb.current = callbacks;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    type Phase = "idle" | "waiting" | "dragging" | "scrolling";
    let phase: Phase = "idle";
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;
    let lastTouchEndTime = 0;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    // --- タッチ ---
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      phase = "waiting";
      clearTimer();
      timer = setTimeout(() => {
        phase = "dragging";
        cb.current.onStart(startX, startY);
        cb.current.onMove(startX, startY); // 長押し確定時点で単セルプレビューを表示
      }, delay);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (phase === "idle" || phase === "scrolling") return;
      const t = e.touches[0];
      if (phase === "waiting") {
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (dx > moveThreshold || dy > moveThreshold) {
          clearTimer();
          phase = "scrolling";
        }
        return;
      }
      // dragging: スクロールを止めてドラッグ座標を通知
      e.preventDefault();
      cb.current.onMove(t.clientX, t.clientY);
    };

    const onTouchEnd = () => {
      lastTouchEndTime = Date.now();
      clearTimer();
      if (phase === "dragging") {
        cb.current.onEnd();
      } else if (phase === "waiting") {
        // 長押し前に離した = タップ: onStart → onEnd を即時呼び出し
        cb.current.onStart(startX, startY);
        cb.current.onEnd();
      }
      phase = "idle";
    };

    // --- マウス ---
    const onMouseDown = (e: MouseEvent) => {
      // タッチ後にブラウザが生成する合成 mousedown を無視する
      if (Date.now() - lastTouchEndTime < 500) return;
      phase = "dragging";
      startX = e.clientX;
      startY = e.clientY;
      cb.current.onStart(e.clientX, e.clientY);
    };

    const onDocMouseMove = (e: MouseEvent) => {
      if (phase !== "dragging") return;
      cb.current.onMove(e.clientX, e.clientY);
    };

    const onDocMouseUp = () => {
      if (phase === "dragging") cb.current.onEnd();
      phase = "idle";
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onDocMouseMove);
    document.addEventListener("mouseup", onDocMouseUp);

    return () => {
      clearTimer();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onDocMouseMove);
      document.removeEventListener("mouseup", onDocMouseUp);
    };
  }, [ref, delay, moveThreshold]);
}
