import { useEffect, useState } from "react";
import type { Card } from "../../types";
import { CardView } from "../cards/Card";

export interface FlyingCardVisual {
  key: string;
  card?: Card | null;
  faceDown: boolean;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  w: number;
  h: number;
  opacity?: number;
}

/**
 * Overlay layer for temporary transfer sprites.
 * Parent must be position:relative covering the stage.
 */
export function CardTransferLayer({
  cards,
}: {
  cards: FlyingCardVisual[];
}) {
  return (
    <div className="gc-transfer-layer" aria-hidden>
      {cards.map((c) => (
        <div
          key={c.key}
          className="gc-fly-card"
          style={{
            transform: `translate(${c.x - c.w / 2}px, ${c.y - c.h / 2}px) rotate(${c.rotation}deg) scale(${c.scale})`,
            width: c.w,
            height: c.h,
            opacity: c.opacity ?? 1,
          }}
        >
          <CardView card={c.card} faceDown={c.faceDown} width={c.w} height={c.h} />
        </div>
      ))}
    </div>
  );
}

/** Hook-friendly flying card map controller */
export function useFlyingCards() {
  const [cards, setCards] = useState<Map<string, FlyingCardVisual>>(new Map());

  const upsert = (v: FlyingCardVisual) => {
    setCards((prev) => {
      const next = new Map(prev);
      next.set(v.key, v);
      return next;
    });
  };

  const remove = (key: string) => {
    setCards((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const list = Array.from(cards.values());

  return { list, upsert, remove, clear: () => setCards(new Map()) };
}

/** Dev FPS overlay */
export function PerfOverlay({
  show,
  fps,
  flying,
  tweens,
  queued,
  ping,
}: {
  show: boolean;
  fps: number;
  flying: number;
  tweens: number;
  queued: number;
  ping?: number;
}) {
  if (!show) return null;
  return (
    <div className="gc-perf">
      <div>FPS {fps}</div>
      <div>Fly {flying}</div>
      <div>Tween {tweens}</div>
      <div>Q {queued}</div>
      {ping != null && <div>Ping {ping}ms</div>}
    </div>
  );
}

export function useFps(enabled: boolean) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      frames += 1;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
  return fps;
}
