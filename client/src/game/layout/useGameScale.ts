import { useEffect, useState } from "react";
import { computeTableLayout, type TableLayout } from "./TableLayoutEngine";

export function useGameScale(playerCount = 6, containerRef?: React.RefObject<HTMLElement | null>) {
  const [layout, setLayout] = useState<TableLayout>(() =>
    computeTableLayout(typeof window !== "undefined" ? window.innerWidth : 1280, typeof window !== "undefined" ? window.innerHeight : 800, {
      playerCount,
    })
  );

  useEffect(() => {
    const el = containerRef?.current;

    const measure = () => {
      const w = el?.clientWidth ?? window.innerWidth;
      const h = el?.clientHeight ?? window.innerHeight;
      setLayout(computeTableLayout(w, h, { playerCount }));
    };

    measure();

    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el!);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [playerCount, containerRef]);

  return layout;
}
