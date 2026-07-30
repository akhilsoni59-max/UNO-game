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
      <svg width="38" height="38" viewBox="0 0 38 38">
        <rect x="4" y="4" width="30" height="30" rx="3" transform="rotate(45 19 19)" />
        <g
          transform={`translate(19,19) scale(${direction === 1 ? 1 : -1},1)`}
          className={spinning ? "gc-dir-arrows is-spinning" : "gc-dir-arrows"}
        >
          <path d="M-8-7 2-7 2-12 11 0 2 12 2 7H-8Z" />
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
      aria-label={`Current color ${color}`}
    >
      <span className="gc-color-swatch" />
      <span className="gc-color-label">{color}</span>
    </div>
  );
}
