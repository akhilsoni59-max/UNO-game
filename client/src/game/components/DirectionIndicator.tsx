import type { Point } from "../layout/TableLayoutEngine";
import type { Color } from "../../types";

export function DirectionIndicator({
  pos,
  direction,
  spinning,
}: {
  pos: Point;
  direction: number;
  spinning?: boolean;
}) {
  return (
    <div
      className={`gc-direction ${spinning ? "is-spin" : ""}`}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)",
        zIndex: 6,
      }}
      aria-label={direction === 1 ? "Clockwise" : "Counter-clockwise"}
    >
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="rgba(8,12,20,0.55)" stroke="rgba(255,255,255,0.12)" />
        <g
          transform={`translate(28,28) scale(${direction === 1 ? 1 : -1},1)`}
          className={spinning ? "gc-dir-arrows is-spinning" : "gc-dir-arrows"}
        >
          <path
            d="M -14 -2 A 14 14 0 0 1 10 -8"
            fill="none"
            stroke="rgba(232,214,160,0.9)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M 10 -8 L 4 -14 L 2 -4 Z" fill="rgba(232,214,160,0.9)" />
          <path
            d="M 14 2 A 14 14 0 0 1 -10 8"
            fill="none"
            stroke="rgba(232,214,160,0.55)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M -10 8 L -4 14 L -2 4 Z" fill="rgba(232,214,160,0.55)" />
        </g>
      </svg>
    </div>
  );
}

export function ColorIndicator({
  pos,
  color,
}: {
  pos: Point;
  color: Color;
}) {
  return (
    <div
      className={`gc-color-ind color-${color}`}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)",
        zIndex: 6,
      }}
    >
      <span className="gc-color-swatch" />
      <span className="gc-color-label">{color}</span>
    </div>
  );
}
