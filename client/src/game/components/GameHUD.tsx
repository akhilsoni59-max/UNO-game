import type { Color } from "../../types";
import { sound } from "../sound/SoundManager";

export function GameHUD({
  code,
  color,
  direction,
  pendingDraw,
  deckCount,
  isYourTurn,
  muted,
  onToggleMute,
  onLeave,
  onOne,
  showOne,
  onPass,
  canPass,
  onDrawPenalty,
  pendingLabel,
}: {
  code: string;
  color: Color;
  direction: number;
  pendingDraw: number;
  deckCount: number;
  isYourTurn: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
  onOne: () => void;
  showOne: boolean;
  onPass: () => void;
  canPass: boolean;
  onDrawPenalty: () => void;
  pendingLabel?: string;
}) {
  return (
    <div className="gc-hud">
      <div className="gc-hud-left">
        <span className="gc-pill">Room {code}</span>
        <span className={`gc-pill color-${color}`}>
          <i className="gc-dot" /> {color}
        </span>
        <span className="gc-pill">{direction === 1 ? "CW →" : "← CCW"}</span>
        {pendingDraw > 0 && <span className="gc-pill warn">Stack +{pendingDraw}</span>}
        <span className="gc-pill">Deck {deckCount}</span>
      </div>
      <div className="gc-hud-center">
        {isYourTurn ? <span className="gc-your-turn">Your turn</span> : null}
      </div>
      <div className="gc-hud-right">
        {showOne && (
          <button type="button" className="gc-btn one" onClick={onOne}>
            ONE
          </button>
        )}
        {canPass && (
          <button type="button" className="gc-btn ghost" onClick={onPass}>
            Pass
          </button>
        )}
        {pendingDraw > 0 && pendingLabel && (
          <button type="button" className="gc-btn danger" onClick={onDrawPenalty}>
            {pendingLabel}
          </button>
        )}
        <button
          type="button"
          className="gc-btn ghost"
          onClick={() => {
            sound.unlock();
            onToggleMute();
          }}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "Muted" : "Sound"}
        </button>
        <button type="button" className="gc-btn ghost" onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}
