import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LobbyState, RuleSettings } from "../types";
import { socket } from "../socket";
import { rememberRoom } from "../identity";

const RULE_OPTIONS: Array<{
  key: keyof RuleSettings;
  title: string;
  description: string;
}> = [
  { key: "stacking", title: "Penalty stacking", description: "Stack the same +2 or +4 card." },
  { key: "jumpIn", title: "Jump-in", description: "Play an identical card out of turn." },
  { key: "drawUntilPlayable", title: "Draw to match", description: "Keep drawing until a playable card appears." },
  { key: "sevenZero", title: "7–0", description: "Sevens swap hands; zeroes rotate every hand." },
];

export function Lobby({ state }: { state: LobbyState }) {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const link = useMemo(() => `${window.location.origin}/room/${state.code}`, [state.code]);
  const you = state.players.find((player) => player.isYou);
  const isHost = !!you?.isHost;
  const connectedCount = state.players.filter((player) => player.connected).length;
  const canStart = isHost && connectedCount >= state.minPlayers;

  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  function start() {
    setError("");
    setBusy(true);
    socket.emit("start_game", (response: { ok: boolean; error?: string }) => {
      setBusy(false);
      if (!response?.ok) setError(response?.error || "Could not start");
    });
  }

  function leave() {
    setBusy(true);
    socket.emit("leave_room", () => {
      rememberRoom(null);
      setBusy(false);
      nav("/");
    });
  }

  function updateRules(next: RuleSettings) {
    if (!isHost || busy) return;
    setBusy(true);
    setError("");
    socket.emit("set_rules", { rules: next }, (response: { ok: boolean; error?: string }) => {
      setBusy(false);
      if (!response?.ok) setError(response?.error || "Rules could not be updated");
    });
  }

  function addBot() {
    setBusy(true);
    setError("");
    socket.emit("add_bot", (response: { ok: boolean; error?: string }) => {
      setBusy(false);
      if (!response?.ok) setError(response?.error || "Bot could not join");
    });
  }

  function removePlayer(targetId: string, name: string, isBot?: boolean) {
    if (!isBot && !window.confirm(`Remove ${name} from this room?`)) return;
    socket.emit("remove_player", { targetId }, (response: { ok: boolean; error?: string }) => {
      if (!response?.ok) setError(response?.error || "Player could not be removed");
    });
  }

  return (
    <div className="lobby">
      <div className="lobby-panel">
        <header className="lobby-header">
          <div>
            <div className="lobby-eyebrow">ROOM CODE</div>
            <div className="room-code">{state.code}</div>
            <div className="link-box">
              <input
                aria-label="Room invitation link"
                readOnly
                value={link}
                onFocus={(event) => event.target.select()}
              />
              <button className="btn btn-ghost" type="button" onClick={copy}>
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
          <div className="lobby-capacity">
            <strong>{connectedCount}/{state.maxPlayers} players</strong>
            <span>
              {connectedCount < state.minPlayers
                ? `Waiting for ${state.minPlayers - connectedCount} more`
                : "Table ready"}
            </span>
          </div>
        </header>

        <div className="lobby-section-heading">
          <div>
            <small>SEATING</small>
            <h3>Players in lobby</h3>
          </div>
        </div>
        <div className="player-grid">
          {state.players.map((player) => (
            <div
              key={player.id}
              className={`player-chip ${player.isYou ? "you" : ""} ${!player.connected ? "disconnected" : ""}`}
            >
              <span className="name">
                {player.name}
                {player.isBot && <small className="player-bot-badge">BOT</small>}
              </span>
              <span className="meta">
                {player.isHost ? "Host" : player.isBot ? "Practice player" : "Player"}
                {player.isYou ? " · You" : ""}
                {!player.connected ? " · offline" : ""}
              </span>
              {isHost && !player.isYou && (
                <button
                  type="button"
                  className="player-remove"
                  onClick={() => removePlayer(player.id, player.name, player.isBot)}
                  aria-label={`Remove ${player.name}`}
                  title={`Remove ${player.name}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {Array.from({ length: Math.max(0, state.maxPlayers - state.players.length) }).map(
            (_, index) => (
              <div key={`empty-${index}`} className="player-chip is-empty">
                <span className="name">Open seat</span>
                <span className="meta">Share the room link</span>
              </div>
            )
          )}
        </div>

        <section className="lobby-rules" aria-labelledby="lobby-rules-title">
          <div className="lobby-section-heading">
            <div>
              <small>MATCH CONFIGURATION</small>
              <h3 id="lobby-rules-title">House rules</h3>
            </div>
            <span>{Object.values(state.rules).some(Boolean) ? "CUSTOM" : "CLASSIC"}</span>
          </div>
          <div className="lobby-rule-grid">
            {RULE_OPTIONS.map((option) => {
              const active = state.rules[option.key];
              return (
                <button
                  type="button"
                  key={option.key}
                  className={`lobby-rule-toggle ${active ? "is-active" : ""}`}
                  aria-pressed={active}
                  disabled={!isHost || busy}
                  onClick={() => updateRules({ ...state.rules, [option.key]: !active })}
                >
                  <i aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {!isHost && <p className="lobby-rule-note">The host controls this match preset.</p>}
        </section>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        <footer className="lobby-actions">
          {isHost && state.players.length < state.maxPlayers && (
            <button className="btn btn-ghost" type="button" onClick={addBot} disabled={busy}>
              Add practice bot
            </button>
          )}
          {isHost ? (
            <button className="btn btn-primary" type="button" onClick={start} disabled={!canStart || busy}>
              {connectedCount < state.minPlayers
                ? `Need ${state.minPlayers - connectedCount} more`
                : busy
                  ? "Preparing table…"
                  : "Start game"}
            </button>
          ) : (
            <div className="lobby-waiting">Waiting for the host to start…</div>
          )}
          <button className="btn btn-ghost" type="button" onClick={leave} disabled={busy}>
            Leave room
          </button>
        </footer>
      </div>
    </div>
  );
}
