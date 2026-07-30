import type { CSSProperties } from "react";
import type { Card } from "../types";
import "../styles/card.css";

type Size = "sm" | "md" | "lg";

interface Props {
  card?: Card | null;
  faceDown?: boolean;
  size?: Size;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
  glow?: boolean;
}

/** Map game card → raster asset path (pure PNG, no SVG). */
export function cardAssetPath(card: Card): string {
  if (card.type === "number") {
    return `/assets/cards/${card.color}_number_${card.value ?? 0}.png`;
  }
  if (card.type === "wild" || card.type === "wild4") {
    return `/assets/cards/black_${card.type}.png`;
  }
  return `/assets/cards/${card.color}_${card.type}.png`;
}

const SIZE_PX: Record<Size, { w: number; h: number }> = {
  sm: { w: 54, h: 81 },
  md: { w: 92, h: 138 },
  lg: { w: 118, h: 177 },
};

export function CardView({
  card,
  faceDown = false,
  size = "lg",
  className = "",
  style,
  onClick,
  disabled,
  glow,
}: Props) {
  const sizeClass = size === "sm" ? "sm" : size === "md" ? "md" : "";
  const interactive = onClick && !disabled;
  const dims = SIZE_PX[size];

  const src =
    faceDown || !card
      ? "/assets/card-back.jpg"
      : cardAssetPath(card);

  return (
    <div
      className={`pcard ${sizeClass} ${className} ${interactive ? "clickable" : ""} ${glow ? "playable-glow" : ""} ${faceDown || !card ? "is-back" : ""}`}
      style={{ width: dims.w, height: dims.h, ...style }}
      onClick={disabled ? undefined : onClick}
      role={onClick ? "button" : undefined}
    >
      <img
        className="pcard-raster"
        src={src}
        alt={faceDown || !card ? "Card back" : `${card.color} ${card.type}`}
        draggable={false}
        width={dims.w}
        height={dims.h}
      />
    </div>
  );
}

export function DrawPile({
  count,
  onClick,
  disabled,
  size = "lg",
}: {
  count: number;
  onClick?: () => void;
  disabled?: boolean;
  size?: Size;
}) {
  const dims = SIZE_PX[size];
  return (
    <button
      className="draw-pile-btn"
      onClick={onClick}
      disabled={disabled}
      type="button"
      aria-label="Draw card"
    >
      <div className="stack-wrap" style={{ width: dims.w, height: dims.h }}>
        {count > 2 && (
          <div className="stack-layer stack-offset-2">
            <CardView faceDown size={size} />
          </div>
        )}
        {count > 1 && (
          <div className="stack-layer stack-offset-1">
            <CardView faceDown size={size} />
          </div>
        )}
        <div className="stack-layer">
          <CardView faceDown size={size} />
        </div>
      </div>
    </button>
  );
}
