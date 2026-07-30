import type { CSSProperties } from "react";
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
  onOpenSettings,
  onLeave,
  onOne,
  showOne,
  oneDeadline,
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
  onOpenSettings: () => void;
  onLeave: () => void;
  onOne: () => void;
  showOne: boolean;
  oneDeadline?: number | null;
  onPass: () => void;
  canPass: boolean;
  onDrawPenalty: () => void;
  pendingLabel?: string;
}) {
  return (
    <header className="gc-hud">
      <div className="gc-hud-left">
        <span className="gc-game-mark" aria-label="Chroma Arena">
          <i><b /><b /><b /><b /></i>
          <span><strong>CHROMA</strong><small>ARENA</small></span>
        </span>
        <span className="gc-room-code"><small>PRIVATE TABLE</small>{code}</span>
      </div>

      <div className="gc-hud-center">
        <span className={`gc-turn-status ${isYourTurn ? "is-live" : ""}`}>
          <i />
          {isYourTurn ? "YOUR MOVE" : "OPPONENT PLAYING"}
        </span>
        <span className="gc-match-meta">
          <b className={`color-${color}`}><i className="gc-dot" />{color}</b>
          <b>{direction === 1 ? "CLOCKWISE" : "COUNTER-CLOCKWISE"}</b>
          <b>{deckCount} IN DRAW PILE</b>
          {pendingDraw > 0 && <b className="warn">+{pendingDraw} PENALTY</b>}
        </span>
      </div>

      <div className="gc-hud-right">
        {showOne && (
          <button
            key={oneDeadline ?? "one"}
            type="button"
            className="gc-one-button"
            style={
              {
                "--one-window": `${Math.max(120, (oneDeadline ?? Date.now() + 3000) - Date.now())}ms`,
              } as CSSProperties
            }
            onClick={onOne}
            aria-label="Call 1 before the three second timer ends"
          >
            <svg className="gc-one-ring" viewBox="0 0 44 44" aria-hidden="true">
              <circle className="track" cx="22" cy="22" r="19" pathLength="100" />
              <circle className="progress" cx="22" cy="22" r="19" pathLength="100" />
            </svg>
            <strong>1</strong>
            <small>CALL</small>
          </button>
        )}
        {canPass && (
          <button type="button" className="gc-btn ghost" onClick={onPass}>
            PASS
          </button>
        )}
        {pendingDraw > 0 && pendingLabel && (
          <button type="button" className="gc-btn danger" onClick={onDrawPenalty}>
            {pendingLabel}
          </button>
        )}
        <button
          type="button"
          className="gc-icon-btn"
          onClick={() => {
            sound.unlock();
            onToggleMute();
          }}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          title={muted ? "Unmute sound" : "Mute sound"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4Z" />
            {muted ? (
              <path d="m17 9 4 6m0-6-4 6" />
            ) : (
              <path d="M16 9.2c1.2 1.5 1.2 4.1 0 5.6M19 7c2.5 2.7 2.5 7.3 0 10" />
            )}
          </svg>
        </button>
        <button
          type="button"
          className="gc-icon-btn gc-settings-button"
          onClick={onOpenSettings}
          aria-label="Open game settings"
          title="Game settings"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
            <path d="m19.2 13.3 1.5 1.2-1.8 3.1-1.8-.7a7.8 7.8 0 0 1-2.3 1.3l-.3 1.9h-3.6l-.3-1.9a7.8 7.8 0 0 1-2.3-1.3l-1.8.7-1.8-3.1 1.5-1.2a8.1 8.1 0 0 1 0-2.6L4.7 9.5l1.8-3.1 1.8.7a7.8 7.8 0 0 1 2.3-1.3l.3-1.9h3.6l.3 1.9a7.8 7.8 0 0 1 2.3 1.3l1.8-.7 1.8 3.1-1.5 1.2a8.1 8.1 0 0 1 0 2.6Z" />
          </svg>
        </button>
        <button
          type="button"
          className="gc-btn ghost gc-leave-button"
          onClick={onLeave}
          aria-label="Leave table"
          title="Leave table"
        >
          LEAVE
        </button>
      </div>
    </header>
  );
}
