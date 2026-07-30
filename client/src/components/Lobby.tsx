import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LobbyState } from "../types";
import { socket } from "../socket";
import { rememberRoom } from "../identity";

export function Lobby({ state }: { state: LobbyState }) {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const link = useMemo(() => `${window.location.origin}/room/${state.code}`, [state.code]);
  const you = state.players.find((p) => p.isYou);
  const isHost = you?.isHost;
  const connectedCount = state.players.filter((p) => p.connected).length;
  const canStart = isHost && connectedCount >= state.minPlayers;

  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function start() {
    setError("");
    setBusy(true);
    socket.emit("start_game", (res: { ok: boolean; error?: string }) => {
      setBusy(false);
      if (!res?.ok) setError(res?.error || "Could not start");
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
              {connectedCount}/{state.maxPlayers} players
            </div>
            <div>
              Need {state.minPlayers}+ to start
              {connectedCount < state.minPlayers ? " · waiting for friends" : " · ready"}
            </div>
          </div>
        </div>

        <h3 style={{ margin: "0 0 8px" }}>Players in lobby</h3>
        <div className="player-grid">
          {state.players.map((p) => (
            <div key={p.id} className={`player-chip ${p.isYou ? "you" : ""} ${!p.connected ? "disconnected" : ""}`}>
              <span className="name">{p.name}</span>
              <span className="meta">
                {p.isHost ? "Host" : "Player"}
                {p.isYou ? " · You" : ""}
                {!p.connected ? " · offline…" : ""}
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

        {error && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div className="lobby-actions">
          {isHost ? (
            <button className="btn btn-primary" type="button" onClick={start} disabled={!canStart || busy}>
              {connectedCount < state.minPlayers
                ? `Need ${state.minPlayers - connectedCount} more…`
                : "Start game"}
            </button>
          ) : (
            <div style={{ color: "var(--muted)", fontWeight: 600 }}>Waiting for host to start…</div>
          )}
          <button className="btn btn-ghost" type="button" onClick={leave} disabled={busy}>
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}
