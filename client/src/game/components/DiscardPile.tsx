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
  dragActive?: boolean;
  onDropCard?: () => void;
}

function rotFromId(id: string, i: number) {
  let h = i * 17;
  for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) % 360;
  return ((h % 17) - 8) * 0.9;
}

export function DiscardPile({
  pos,
  top,
  cardW,
  cardH,
  salt = "d",
  hidden,
  dragActive,
  onDropCard,
}: Props) {
  const stack = useMemo(() => {
    if (!top) return [] as { id: string; rot: number; dx: number; dy: number }[];
    return [
      { id: top.id, rot: rotFromId(top.id, 0), dx: 0, dy: 0 },
    ];
  }, [top, salt]);

  return (
    <div
      className={`gc-discard ${dragActive ? "is-drop-target" : ""}`}
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
      onDragOver={(event) => {
        if (!dragActive) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (!dragActive) return;
        event.preventDefault();
        onDropCard?.();
      }}
    >
      <span className="gc-pile-plinth" aria-hidden="true" />
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
      <span className="gc-pile-label">PLAY</span>
    </div>
  );
}
