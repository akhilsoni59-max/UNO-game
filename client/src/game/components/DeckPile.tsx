import { CardView } from "../cards/Card";
import type { Point } from "../layout/TableLayoutEngine";

interface Props {
  pos: Point;
  count: number;
  cardW: number;
  cardH: number;
  canDraw: boolean;
  onDraw: () => void;
  bounce?: boolean;
}

export function DeckPile({ pos, count, cardW, cardH, canDraw, onDraw, bounce }: Props) {
  const layers = Math.min(3, Math.max(1, Math.ceil(count / 20)));
  return (
    <button
      type="button"
      className={`gc-pile-btn ${canDraw ? "is-active" : ""} ${bounce ? "is-bounce" : ""}`}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: cardW,
        height: cardH,
        transform: "translate(-50%, -50%)",
        zIndex: 8,
      }}
      disabled={!canDraw}
      onClick={onDraw}
      aria-label={`Draw pile, ${count} cards`}
    >
      {Array.from({ length: layers }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${i * 2}px, ${i * 2}px)`,
            zIndex: i,
          }}
        >
          <CardView faceDown width={cardW} height={cardH} />
        </div>
      ))}
      <span className="gc-pile-count">{count}</span>
    </button>
  );
}
