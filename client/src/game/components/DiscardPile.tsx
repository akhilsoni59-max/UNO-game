import { useMemo } from "react";
import type { Card } from "../../types";
import { CardView } from "../cards/Card";
import type { Point } from "../layout/TableLayoutEngine";

interface Props {
  pos: Point;
  top: Card | null;
  cardW: number;
  cardH: number;
  /** Deterministic salt for stack offsets */
  salt?: string;
  hidden?: boolean;
}

function rotFromId(id: string, i: number) {
  let h = i * 17;
  for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) % 360;
  return ((h % 17) - 8) * 0.9;
}

export function DiscardPile({ pos, top, cardW, cardH, salt = "d", hidden }: Props) {
  const stack = useMemo(() => {
    if (!top) return [] as { id: string; rot: number; dx: number; dy: number }[];
    // Fake 2 under-cards for depth (visual only)
    return [
      { id: `${salt}-2`, rot: rotFromId(top.id, 2), dx: -4, dy: 3 },
      { id: `${salt}-1`, rot: rotFromId(top.id, 1), dx: 3, dy: 2 },
      { id: top.id, rot: rotFromId(top.id, 0), dx: 0, dy: 0 },
    ];
  }, [top, salt]);

  return (
    <div
      className="gc-discard"
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: cardW,
        height: cardH,
        transform: "translate(-50%, -50%)",
        zIndex: 8,
      }}
      aria-label={top ? `Discard ${top.color} ${top.type}` : "Empty discard"}
    >
      {stack.map((s, i) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${s.dx}px, ${s.dy}px) rotate(${s.rot}deg)`,
            zIndex: i,
            opacity: hidden && i === stack.length - 1 ? 0 : i < stack.length - 1 ? 0.85 : 1,
            transition: "opacity 120ms linear",
          }}
        >
          {i === stack.length - 1 && top ? (
            <CardView card={top} width={cardW} height={cardH} />
          ) : (
            <CardView faceDown width={cardW} height={cardH} />
          )}
        </div>
      ))}
    </div>
  );
}
