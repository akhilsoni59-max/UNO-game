import type { CSSProperties } from "react";
import type { Card as CardModel } from "../../types";
import { gameTokens } from "../tokens/gameTokens";
import { CardBack } from "./CardBack";
import { CardFace } from "./CardFace";

export type CardSize = "sm" | "md" | "lg" | "hero";

const SIZE: Record<CardSize, { w: number; h: number }> = {
  sm: { w: gameTokens.opponentCardW, h: gameTokens.opponentCardH },
  md: { w: 78, h: 111 },
  lg: { w: gameTokens.cardW, h: gameTokens.cardH },
  hero: { w: 128, h: 183 },
};

export interface CardProps {
  card?: CardModel | null;
  faceDown?: boolean;
  size?: CardSize;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
  playable?: boolean;
  dimmed?: boolean;
  selected?: boolean;
  shaking?: boolean;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  tabIndex?: number;
  disabled?: boolean;
}

export function CardView({
  card,
  faceDown = false,
  size = "lg",
  width,
  height,
  className = "",
  style,
  playable,
  dimmed,
  selected,
  shaking,
  onClick,
  onPointerEnter,
  onPointerLeave,
  tabIndex,
  disabled,
}: CardProps) {
  const dims = SIZE[size];
  const w = width ?? dims.w;
  const h = height ?? dims.h;
  const showBack = faceDown || !card;
  const interactive = !!onClick && !disabled;

  return (
    <div
      className={[
        "gc-card",
        playable ? "is-playable" : "",
        dimmed ? "is-dimmed" : "",
        selected ? "is-selected" : "",
        shaking ? "is-shake" : "",
        interactive ? "is-interactive" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: w, height: h, ...style }}
      onClick={disabled ? undefined : onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? tabIndex ?? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!disabled) onClick();
              }
            }
          : undefined
      }
      aria-disabled={disabled || undefined}
      aria-label={
        showBack
          ? "Face-down card"
          : card
            ? `${card.color} ${card.type === "number" ? card.value : card.type}${playable ? ", playable" : ""}`
            : "Card"
      }
    >
      <div className="gc-card-inner">
        {showBack ? <CardBack /> : card ? <CardFace card={card} /> : <CardBack />}
      </div>
    </div>
  );
}
