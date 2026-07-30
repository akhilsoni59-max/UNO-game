import type { Card, GamePlayer } from "../../types";

export function PlayerSelector({
  card,
  players,
  onPick,
  onCancel,
}: {
  card: Card | null;
  players: GamePlayer[];
  onPick: (playerId: string) => void;
  onCancel: () => void;
}) {
  if (!card) return null;
  return (
    <div className="gc-choice-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="gc-player-selector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <small>7–0 HOUSE RULE</small>
        <h2 id="swap-title">Choose a hand to swap</h2>
        <p>Your hand and the selected player’s hand will exchange immediately.</p>
        <div>
          {players
            .filter((player) => !player.isYou && !player.eliminated)
            .map((player) => (
              <button type="button" key={player.id} onClick={() => onPick(player.id)}>
                <span>{player.name.slice(0, 1).toUpperCase()}</span>
                <strong>{player.name}</strong>
                <small>{player.cardCount} cards</small>
              </button>
            ))}
        </div>
        <button type="button" className="gc-choice-cancel" onClick={onCancel}>
          Cancel
        </button>
      </section>
    </div>
  );
}
