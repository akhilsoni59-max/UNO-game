import type { CSSProperties } from "react";
import type { Card as CardModel } from "../../types";
import { gameTokens } from "../tokens/gameTokens";

export type CardSize = "sm" | "md" | "lg" | "hero";

const SIZE: Record<CardSize, { w: number; h: number }> = {
  sm: { w: gameTokens.opponentCardW, h: gameTokens.opponentCardH },
  md: { w: 78, h: 111 },
  lg: { w: gameTokens.cardW, h: gameTokens.cardH },
  hero: { w: 128, h: 183 },
};

const RASTER_ROOT = "/assets/raster-cards";

function rasterCardSrc(card?: CardModel | null, faceDown?: boolean) {
  if (faceDown || !card) return `${RASTER_ROOT}/back.png`;
  if (card.type === "wild4") return `${RASTER_ROOT}/wild4.png`;
  if (card.type === "wild") return `${RASTER_ROOT}/wild.png`;
  if (card.type === "number") {
    return `${RASTER_ROOT}/${card.color}_number_${card.value ?? 0}.png`;
  }
  return `${RASTER_ROOT}/${card.color}_${card.type}.png`;
}

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
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
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
  draggable,
  onDragStart,
  onDragEnd,
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
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      aria-label={
        showBack
          ? "Face-down card"
          : card
            ? `${card.color} ${card.type === "number" ? card.value : card.type}${playable ? ", playable" : ""}`
            : "Card"
      }
    >
      <div className="gc-card-inner">
        <img
          className="gc-card-raster"
          src={rasterCardSrc(card, showBack)}
          alt=""
          draggable={false}
          decoding="async"
        />
      </div>
    </div>
  );
}
