import { useEffect } from "react";

/**
 * 長押し時にカレンダーのスクロールをブロックする
 * @param LONG_PRESS_DELAY 長押しとみなすまでの時間 (ms)
 * @param MOVE_TOLERANCE これ以上動いたらスクロールとみなす (px)
 */
export default function useCalendarScrollBlock(LONG_PRESS_DELAY = 150, MOVE_TOLERANCE = 5) {
  useEffect(() => {
    const wrapper = document.getElementById("ih-cal-wrapper");
    if (!wrapper) return;
    const scroller = wrapper.querySelector(".fc-scroller.fc-scroller-liquid-absolute") as HTMLElement | null;
    if (!scroller) return;

    let pressTimer: number | null = null;
    let isDragMode = false;
    let startX = 0;
    let startY = 0;

    const clearPressTimer = () => {
      if (pressTimer !== null) {
        window.clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const resetDragMode = () => {
      clearPressTimer();
      if (isDragMode) {
        isDragMode = false;
        scroller.style.overflowY = "";
        scroller.style.touchAction = "";
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      isDragMode = false;
      clearPressTimer();

      // 一定時間動かなければ、スクロールを無効化
      pressTimer = window.setTimeout(() => {
        isDragMode = true;
        scroller.style.overflowY = "hidden";
        scroller.style.touchAction = "none";
      }, LONG_PRESS_DELAY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);

      if (!isDragMode) {
        // ロングプレス判定中に大きく動いたらスクロールとみなしてキャンセル
        if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) {
          clearPressTimer();
        }
        return;
      }

      e.preventDefault(); // 今回は overflowY: hidden で十分だが一応
    };

    const onTouchEnd = () => {
      resetDragMode();
    };

    const onTouchCancel = () => {
      resetDragMode();
    };

    // touchmove で preventDefault するには passive: false が必要
    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    scroller.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [LONG_PRESS_DELAY, MOVE_TOLERANCE]);
}
