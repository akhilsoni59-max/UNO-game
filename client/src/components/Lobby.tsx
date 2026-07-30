import { useMemo, useState } from "react";
import type { LobbyState } from "../types";
import { socket } from "../socket";

export function Lobby({ state }: { state: LobbyState }) {
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => `${window.location.origin}/room/${state.code}`, [state.code]);
  const you = state.players.find((p) => p.isYou);
  const isHost = you?.isHost;

  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function start() {
    setError("");
    socket.emit("start_game", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setError(res?.error || "Could not start");
    });
  }

  return (
    <div className="lobby">
      <div className="lobby-panel">
        <div className="lobby-header">
          <div>
            <div style={{ color: "var(--muted)", fontWeight: 600, fontSize: "0.85rem" }}>ROOM CODE</div>
            <div className="room-code">{state.code}</div>
            <div className="link-box">
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="btn btn-ghost" type="button" onClick={copy}>
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
          <div style={{ textAlign: "right", color: "var(--muted)" }}>
            <div style={{ fontWeight: 700, color: "var(--ink)" }}>
              {state.players.length}/{state.maxPlayers} players
            </div>
            <div>Start anytime — others can join later if slots open</div>
          </div>
        </div>

        <h3 style={{ margin: "0 0 8px" }}>Players in lobby</h3>
        <div className="player-grid">
          {state.players.map((p) => (
            <div key={p.id} className={`player-chip ${p.isYou ? "you" : ""}`}>
              <span className="name">{p.name}</span>
              <span className="meta">
                {p.isHost ? "Host" : "Player"}
                {p.isYou ? " · You" : ""}
                {!p.connected ? " · reconnecting…" : ""}
              </span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, state.maxPlayers - state.players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="player-chip" style={{ opacity: 0.45 }}>
              <span className="name">Waiting…</span>
              <span className="meta">Open slot</span>
            </div>
          ))}
        </div>

        {error && <div className="error-banner" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="lobby-actions">
          {isHost ? (
            <button className="btn btn-primary" type="button" onClick={start}>
              Start game
            </button>
          ) : (
            <div style={{ color: "var(--muted)", fontWeight: 600 }}>Waiting for host to start…</div>
          )}
        </div>
      </div>
    </div>
  );
}
