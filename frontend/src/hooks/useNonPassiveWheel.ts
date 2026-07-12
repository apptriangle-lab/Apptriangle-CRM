import { useEffect, type RefObject } from "react";

/** Attach a non-passive wheel listener so preventDefault() works for custom scroll regions. */
export function useNonPassiveWheel(
  ref: RefObject<HTMLElement | null>,
  handler: (event: WheelEvent) => void,
  enabled = true,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const onWheel = (event: WheelEvent) => handler(event);
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [ref, handler, enabled]);
}
