import { sound } from "../sound/SoundManager";
import { useEffect } from "react";

export function GameResults({
  open,
  youWin,
  winnerName,
  isHost,
  onRematch,
}: {
  open: boolean;
  youWin: boolean;
  winnerName: string;
  isHost: boolean;
  onRematch: () => void;
}) {
  useEffect(() => {
    if (open) sound.play("win");
  }, [open]);

  if (!open) return null;
  return (
    <div className="gc-modal-backdrop">
      <div className="gc-modal gc-winner">
        <div className="gc-win-burst" aria-hidden />
        <h2>{youWin ? "Victory" : `${winnerName} wins`}</h2>
        <p>Match complete</p>
        {isHost ? (
          <button type="button" className="gc-btn primary" onClick={onRematch}>
            Back to lobby
          </button>
        ) : (
          <p className="gc-muted">Waiting for host…</p>
        )}
      </div>
    </div>
  );
}
