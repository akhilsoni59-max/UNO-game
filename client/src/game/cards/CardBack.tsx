import { gameTokens } from "../tokens/gameTokens";

const W = gameTokens.cardW;
const H = gameTokens.cardH;
const R = W * gameTokens.cardRadiusRatio;

/**
 * Original card back — dark field, micro-pattern, central emblem.
 * No small text (stays clear at opponent scale).
 */
export function CardBack({ className = "" }: { className?: string }) {
  const id = "cb";
  return (
    <svg
      className={`gc-card-svg gc-card-back ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label="Card back"
    >
      <defs>
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gameTokens.cardBackBase} />
          <stop offset="100%" stopColor="#0a0e18" />
        </linearGradient>
        <pattern id={`${id}-pat`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <rect width="10" height="10" fill={gameTokens.cardBackPattern} />
          <path d="M0 10 L10 0" stroke="rgba(196,168,110,0.12)" strokeWidth="1" />
          <circle cx="5" cy="5" r="1.1" fill="rgba(196,168,110,0.18)" />
        </pattern>
        <radialGradient id={`${id}-glow`} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="rgba(196,168,110,0.2)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx={R} fill="#05070c" />
      <rect x="2" y="2" width={W - 4} height={H - 4} rx={R - 1} fill={`url(#${id}-base)`} />
      <rect x="6" y="6" width={W - 12} height={H - 12} rx={R - 2} fill={`url(#${id}-pat)`} />
      <rect x="6" y="6" width={W - 12} height={H - 12} rx={R - 2} fill={`url(#${id}-glow)`} />

      {/* Inner frame */}
      <rect
        x="10"
        y="10"
        width={W - 20}
        height={H - 20}
        rx={R - 3}
        fill="none"
        stroke="rgba(196,168,110,0.35)"
        strokeWidth="1.5"
      />
      <rect
        x="14"
        y="14"
        width={W - 28}
        height={H - 28}
        rx={R - 4}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />

      {/* Central emblem — hex + diamond (original mark) */}
      <g transform={`translate(${W / 2}, ${H / 2})`}>
        <polygon
          points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14"
          fill="none"
          stroke={gameTokens.cardBackEmblem}
          strokeWidth="2"
          opacity="0.85"
        />
        <polygon
          points="0,-14 12,-7 12,7 0,14 -12,7 -12,-7"
          fill={gameTokens.cardBackEmblem}
          opacity="0.55"
        />
        {/* Four accent chips */}
        <circle cx="0" cy="-20" r="3" fill="#c93c3c" />
        <circle cx="18" cy="0" r="3" fill="#d4a824" />
        <circle cx="0" cy="20" r="3" fill="#2f9e5f" />
        <circle cx="-18" cy="0" r="3" fill="#2f6fbf" />
      </g>

      <rect
        x="2"
        y="2"
        width={W - 4}
        height={H - 4}
        rx={R - 1}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
      />
    </svg>
  );
}
