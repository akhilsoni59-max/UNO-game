import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Point } from "../layout/TableLayoutEngine";

export function TurnBeacon({
  activeName,
  isYourTurn,
  deadline,
  duration,
  connected,
}: {
  activeName: string;
  isYourTurn: boolean;
  deadline: number;
  duration: number;
  connected: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, deadline - now);
  const seconds = Math.ceil(remaining / 1000);
  const progress = Math.max(0, Math.min(1, remaining / Math.max(1, duration)));

  return (
    <div
      className={`gc-turn-beacon ${isYourTurn ? "is-you" : ""} ${!connected ? "is-offline" : ""}`}
      style={
        {
          "--turn-progress": progress,
        } as CSSProperties
      }
      role="status"
      aria-live="polite"
    >
      <span className="gc-turn-orbit" aria-hidden="true" />
      <span>
        <small>{!connected ? "CONNECTION PAUSED" : isYourTurn ? "YOUR MOVE" : "CURRENT TURN"}</small>
        <strong>{!connected ? `${activeName} is reconnecting` : isYourTurn ? "Play a card" : activeName}</strong>
      </span>
      <b aria-label={`${seconds} seconds remaining`}>{seconds}</b>
    </div>
  );
}

export function TableActionDock({
  pos,
  isTurn,
  pendingDraw,
  canDraw,
  canPass,
  playableCount,
  onDraw,
  onPass,
}: {
  pos: Point;
  isTurn: boolean;
  pendingDraw: number;
  canDraw: boolean;
  canPass: boolean;
  playableCount: number;
  onDraw: () => void;
  onPass: () => void;
}) {
  const hint = useMemo(() => {
    if (!isTurn) return "Waiting for the current player";
    if (pendingDraw > 0) return `Penalty waiting · ${pendingDraw} cards`;
    if (canPass) return "Play the card you drew, or pass";
    if (playableCount > 0) return `${playableCount} playable ${playableCount === 1 ? "card" : "cards"}`;
    return "No match · draw a card";
  }, [canPass, isTurn, pendingDraw, playableCount]);

  if (isTurn && pendingDraw === 0 && !canPass && playableCount > 0) return null;

  return (
    <div className={`gc-action-dock ${isTurn ? "is-live" : ""}`} style={{ left: pos.x, top: pos.y }}>
      <span>{hint}</span>
      {isTurn && pendingDraw > 0 ? (
        <button type="button" className="is-penalty" onClick={onDraw}>
          TAKE +{pendingDraw}
        </button>
      ) : canPass ? (
        <button type="button" onClick={onPass}>
          PASS TURN
        </button>
      ) : (
        <button type="button" onClick={onDraw} disabled={!canDraw}>
          DRAW CARD
        </button>
      )}
    </div>
  );
}

export type HandSortMode = "dealt" | "color" | "number";

export function HandSortControl({
  pos,
  mode,
  onChange,
}: {
  pos: Point;
  mode: HandSortMode;
  onChange: (mode: HandSortMode) => void;
}) {
  const modes: HandSortMode[] = ["dealt", "color", "number"];
  return (
    <div className="gc-hand-sort" style={{ left: pos.x, top: pos.y }}>
      <span>SORT</span>
      {modes.map((entry) => (
        <button
          type="button"
          key={entry}
          className={mode === entry ? "is-active" : ""}
          aria-pressed={mode === entry}
          onClick={() => onChange(entry)}
        >
          {entry === "dealt" ? "HAND" : entry.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
