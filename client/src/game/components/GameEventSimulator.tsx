import { useEffect, useState } from "react";
import type { Card, Color, GamePlayer } from "../../types";
import type { GameVisualEvent } from "../events/GameVisualEvents";
import { visualEventId } from "../events/GameVisualEvents";

const demoCards: Record<string, Card> = {
  number: { id: "sim-number", color: "blue", type: "number", value: 7 },
  skip: { id: "sim-skip", color: "red", type: "skip" },
  reverse: { id: "sim-reverse", color: "green", type: "reverse" },
  draw2: { id: "sim-draw2", color: "yellow", type: "draw2" },
  wild: { id: "sim-wild", color: "black", type: "wild" },
  wild4: { id: "sim-wild4", color: "black", type: "wild4" },
};

export function GameEventSimulator({
  players,
  localPlayerId,
  onEvent,
}: {
  players: GamePlayer[];
  localPlayerId?: string;
  onEvent: (event: GameVisualEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const opponentId = players.find((player) => player.id !== localPlayerId)?.id ?? localPlayerId ?? "";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "v") setOpen((value) => !value);
      if (!open || event.target instanceof HTMLInputElement) return;
      const card = demoCards.number;
      if (event.key === "d" && localPlayerId) {
        onEvent({ type: "DRAW_CARD", playerId: localPlayerId, card, eventId: visualEventId("draw-local") });
      }
      if (event.key === "p" && localPlayerId) {
        onEvent({ type: "PLAY_CARD", playerId: localPlayerId, card, eventId: visualEventId("play-local") });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [localPlayerId, onEvent, open]);

  const emitPlay = (key: keyof typeof demoCards) => {
    if (!localPlayerId) return;
    onEvent({
      type: "PLAY_CARD",
      playerId: localPlayerId,
      card: { ...demoCards[key], id: `${demoCards[key].id}-${Date.now()}` },
      eventId: visualEventId(`play-${key}`),
    });
  };

  const emitColor = (color: Color) =>
    onEvent({ type: "COLOR_SELECTED", color, eventId: visualEventId(`color-${color}`) });

  return (
    <aside className={`gc-simulator ${open ? "is-open" : ""}`} aria-label="Visual event simulator">
      <button
        type="button"
        className="gc-sim-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title="Visual simulator (Alt+V)"
      >
        DEV
      </button>
      {open && (
        <div className="gc-sim-panel">
          <div className="gc-sim-heading">
            <strong>Visual events</strong>
            <span>Alt+V</span>
          </div>
          <div className="gc-sim-grid">
            <button type="button" onClick={() => localPlayerId && onEvent({ type: "DRAW_CARD", playerId: localPlayerId, card: demoCards.number, eventId: visualEventId("draw-local") })}>Draw self</button>
            <button type="button" onClick={() => opponentId && onEvent({ type: "DRAW_CARD", playerId: opponentId, count: 1, eventId: visualEventId("draw-opponent") })}>Draw rival</button>
            <button type="button" onClick={() => emitPlay("number")}>Play card</button>
            <button type="button" onClick={() => emitPlay("skip")}>Skip</button>
            <button type="button" onClick={() => emitPlay("reverse")}>Reverse</button>
            <button type="button" onClick={() => emitPlay("draw2")}>Draw two</button>
            <button type="button" onClick={() => emitPlay("wild")}>Wild</button>
            <button type="button" onClick={() => emitPlay("wild4")}>Draw four</button>
            <button type="button" onClick={() => opponentId && onEvent({ type: "TURN_CHANGED", playerId: opponentId, eventId: visualEventId("turn") })}>Next turn</button>
            <button type="button" onClick={() => opponentId && onEvent({ type: "PLAYER_WON", playerId: opponentId, eventId: visualEventId("win") })}>Win state</button>
          </div>
          <div className="gc-sim-colors">
            {(["red", "yellow", "green", "blue"] as Color[]).map((color) => (
              <button key={color} type="button" className={`color-${color}`} onClick={() => emitColor(color)} aria-label={`Set ${color}`} />
            ))}
          </div>
          <p>D = draw · P = play</p>
        </div>
      )}
    </aside>
  );
}
