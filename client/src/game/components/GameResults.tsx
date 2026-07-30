import { useEffect } from "react";
import type { GamePlayer } from "../../types";
import { sound } from "../sound/SoundManager";

export function GameResults({
  open,
  youWin,
  winnerName,
  players,
  ranking,
  currentPlayerId,
  rematchVotes,
  onVoteRematch,
}: {
  open: boolean;
  youWin: boolean;
  winnerName: string;
  players: GamePlayer[];
  ranking: string[];
  currentPlayerId?: string;
  rematchVotes: string[];
  onVoteRematch: () => void;
}) {
  useEffect(() => {
    if (open) sound.play("win");
  }, [open]);

  if (!open) return null;
  const ordered = ranking
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is GamePlayer => !!player);
  const voted = !!currentPlayerId && rematchVotes.includes(currentPlayerId);
  const eligibleCount = players.filter((player) => player.connected !== false && !player.isBot).length;

  return (
    <div className="gc-modal-backdrop">
      <section className="gc-modal gc-winner" role="dialog" aria-modal="true" aria-labelledby="results-title">
        <div className="gc-win-burst" aria-hidden />
        <small className="gc-results-eyebrow">ROUND COMPLETE</small>
        <h2 id="results-title">{youWin ? "Victory" : `${winnerName} wins`}</h2>
        <p>{youWin ? "You controlled the table." : "The table is ready for another round."}</p>
        <ol className="gc-results-ranking">
          {ordered.slice(0, 3).map((player, index) => (
            <li key={player.id} className={player.isYou ? "is-you" : ""}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{player.name}</strong>
              <small>{index === 0 ? "Winner" : `${player.cardCount} cards left`}</small>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="gc-btn primary gc-rematch-vote"
          onClick={onVoteRematch}
          disabled={voted}
        >
          {voted ? "Vote received" : "Vote for rematch"}
        </button>
        <span className="gc-rematch-count">
          {rematchVotes.length}/{eligibleCount} players ready
        </span>
      </section>
    </div>
  );
}
