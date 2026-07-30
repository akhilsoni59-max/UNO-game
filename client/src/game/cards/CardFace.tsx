import type { Card } from "../../types";
import { gameTokens, suitColor } from "../tokens/gameTokens";
import { IconDrawTwo, IconReverse, IconSkip, IconWild, IconWild4 } from "./ActionIcons";

const W = gameTokens.cardW;
const H = gameTokens.cardH;
const R = W * gameTokens.cardRadiusRatio;

function cornerLabel(card: Card): string {
  if (card.type === "number") return String(card.value ?? 0);
  if (card.type === "draw2") return "+2";
  if (card.type === "wild4") return "+4";
  if (card.type === "skip") return "Ø";
  if (card.type === "reverse") return "⇄";
  if (card.type === "wild") return "★";
  return "";
}

/** Readable corner glyphs (symbols for a11y patterns; icons carry meaning) */
function CornerMark({ card, main }: { card: Card; main: string }) {
  if (card.type === "number") {
    return (
      <text
        x="0"
        y="0"
        fill={main}
        fontFamily="Barlow Condensed, 'Arial Narrow', sans-serif"
        fontWeight="800"
        fontSize="18"
        dominantBaseline="hanging"
      >
        {card.value}
      </text>
    );
  }
  // Small pattern mark for color-blind: shape differs by type
  if (card.type === "skip") {
    return (
      <g transform="scale(0.35)">
        <IconSkip color={main} />
      </g>
    );
  }
  if (card.type === "reverse") {
    return (
      <g transform="scale(0.32)">
        <IconReverse color={main} />
      </g>
    );
  }
  if (card.type === "draw2") {
    return (
      <text fill={main} fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="14" dominantBaseline="hanging">
        +2
      </text>
    );
  }
  if (card.type === "wild" || card.type === "wild4") {
    return (
      <g transform="scale(0.28) translate(0, 8)">
        <IconWild />
      </g>
    );
  }
  return null;
}

function CenterGlyph({ card, ink }: { card: Card; ink: string }) {
  if (card.type === "number") {
    // Distinguish 6 / 9 with underline bar on 6
    const v = card.value ?? 0;
    return (
      <g>
        <text
          x="0"
          y="8"
          textAnchor="middle"
          fill={ink}
          fontFamily="Barlow Condensed, 'Arial Narrow', Impact, sans-serif"
          fontWeight="800"
          fontSize="72"
          style={{ textShadow: "0 2px 0 rgba(0,0,0,0.15)" }}
        >
          {v}
        </text>
        {v === 6 && <rect x="-14" y="28" width="28" height="3.5" rx="1" fill={ink} opacity="0.85" />}
        {v === 9 && <rect x="-14" y="-38" width="28" height="3.5" rx="1" fill={ink} opacity="0.85" />}
      </g>
    );
  }
  if (card.type === "skip") return <IconSkip color={ink} />;
  if (card.type === "reverse") return <IconReverse color={ink} />;
  if (card.type === "draw2") return <IconDrawTwo color={ink} />;
  if (card.type === "wild") return <IconWild />;
  if (card.type === "wild4") return <IconWild4 />;
  return null;
}

export function CardFace({ card, className = "" }: { card: Card; className?: string }) {
  const isWild = card.type === "wild" || card.type === "wild4";
  const suit = isWild ? "black" : (card.color as keyof typeof suitColor);
  const { main, deep } = suitColor[suit] || suitColor.black;
  const ink = isWild ? gameTokens.cardFaceWhite : gameTokens.cardFaceWhite;
  const fieldId = `cf-${card.id}`;

  return (
    <svg
      className={`gc-card-svg ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={`${card.color} ${card.type === "number" ? card.value : card.type}`}
    >
      <defs>
        <linearGradient id={`${fieldId}-field`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={main} />
          <stop offset="100%" stopColor={deep} />
        </linearGradient>
        <linearGradient id={`${fieldId}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <pattern id={`${fieldId}-tex`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.6" fill="rgba(0,0,0,0.06)" />
        </pattern>
        {/* Asymmetric diagonal band — original identity, not white oval */}
        <clipPath id={`${fieldId}-clip`}>
          <rect x="6" y="6" width={W - 12} height={H - 12} rx={R - 2} />
        </clipPath>
      </defs>

      {/* Outer silhouette */}
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx={R} fill="#0a0c10" />
      <rect x="2" y="2" width={W - 4} height={H - 4} rx={R - 1} fill={`url(#${fieldId}-field)`} />
      {/* Inner printed border */}
      <rect
        x="5"
        y="5"
        width={W - 10}
        height={H - 10}
        rx={R - 2}
        fill="none"
        stroke={gameTokens.cardInnerHi}
        strokeWidth="1.25"
        opacity="0.55"
      />

      <g clipPath={`url(#${fieldId}-clip)`}>
        {/* Diagonal interior graphic */}
        <path
          d={`M ${W * 0.05} ${H * 0.72} L ${W * 0.72} ${H * 0.08} L ${W * 0.95} ${H * 0.28} L ${W * 0.28} ${H * 0.92} Z`}
          fill="rgba(255,255,255,0.12)"
        />
        <path
          d={`M ${W * 0.15} ${H * 0.9} L ${W * 0.85} ${H * 0.22} L ${W * 0.92} ${H * 0.32} L ${W * 0.22} ${H * 0.98} Z`}
          fill="rgba(0,0,0,0.12)"
        />
        <rect x="0" y="0" width={W} height={H} fill={`url(#${fieldId}-tex)`} />
        <rect x="0" y="0" width={W} height={H} fill={`url(#${fieldId}-sheen)`} />

        {/* Polymer plate behind center glyph */}
        <ellipse cx={W / 2} cy={H / 2} rx={36} ry={42} fill="rgba(0,0,0,0.18)" />
        <ellipse
          cx={W / 2}
          cy={H / 2}
          rx={32}
          ry={38}
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />

        <g transform={`translate(${W / 2}, ${H / 2})`}>
          <CenterGlyph card={card} ink={ink} />
        </g>

        {/* Corner values */}
        <g transform="translate(12, 12)">
          <CornerMark card={card} main={ink} />
        </g>
        <g transform={`translate(${W - 12}, ${H - 12}) rotate(180)`}>
          <CornerMark card={card} main={ink} />
        </g>

        {/* Color-blind type stripe */}
        <rect
          x="8"
          y={H - 14}
          width={
            card.type === "number"
              ? 10
              : card.type === "skip"
                ? 16
                : card.type === "reverse"
                  ? 22
                  : card.type === "draw2"
                    ? 28
                    : 34
          }
          height="3"
          rx="1"
          fill="rgba(255,255,255,0.35)"
        />
      </g>

      {/* Soft edge darken */}
      <rect
        x="2"
        y="2"
        width={W - 4}
        height={H - 4}
        rx={R - 1}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export { cornerLabel };
