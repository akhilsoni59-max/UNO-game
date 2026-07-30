import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { CardView } from "../game/cards/Card";
import { getPlayerToken, getSavedName, rememberRoom, saveName as persistName } from "../identity";
import type { Card } from "../types";
import { cssVarsFromTokens } from "../game/tokens/gameTokens";

const showcase: Card[] = [
  { id: "s1", color: "red", type: "number", value: 7 },
  { id: "s2", color: "yellow", type: "number", value: 2 },
  { id: "s3", color: "green", type: "skip" },
  { id: "s4", color: "blue", type: "reverse" },
  { id: "s5", color: "black", type: "wild" },
  { id: "s6", color: "green", type: "draw2" },
];

export function Home() {
  const nav = useNavigate();
  const [name, setName] = useState(() => getSavedName());
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function saveName(n: string) {
    setName(n);
    persistName(n);
  }

  function createRoom() {
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    setBusy(true);
    setError("");
    const token = getPlayerToken();
    socket.emit(
      "create_room",
      { name: name.trim(), token },
      (res: { ok: boolean; code?: string; error?: string }) => {
        setBusy(false);
        if (!res?.ok) {
          setError(res?.error || "Could not create room");
          return;
        }
        rememberRoom(res.code || null);
        nav(`/room/${res.code}`);
      }
    );
  }

  function joinRoom() {
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    const c = code.trim().toUpperCase();
    if (!c) {
      setError("Enter a room code");
      return;
    }
    setBusy(true);
    setError("");
    const token = getPlayerToken();
    socket.emit(
      "join_room",
      { code: c, name: name.trim(), token },
      (res: { ok: boolean; code?: string; error?: string }) => {
        setBusy(false);
        if (!res?.ok) {
          setError(res?.error || "Could not join room");
          return;
        }
        rememberRoom(res.code || c);
        nav(`/room/${res.code || c}`);
      }
    );
  }

  return (
    <div className="home game-tokens" style={cssVarsFromTokens() as CSSProperties}>
      <div className="home-showcase" aria-hidden>
        {showcase.map((card, i) => (
          <div
            key={card.id}
            className="home-showcase-card"
            style={{
              transform: `rotate(${(i - 2.5) * 9}deg) translateY(${Math.abs(i - 2.5) * 6}px)`,
              zIndex: i,
            }}
          >
            <CardView card={card} size="md" />
          </div>
        ))}
      </div>

      <div className="home-card">
        <div className="brand">
          <span className="brand-badge">Up to 6 players · Live rooms</span>
          <h1>ChromaCards</h1>
          <p>
            Create a room, share the link, and race to empty your hand. Classic color cards, premium table, real multiplayer.
          </p>
        </div>

        <div className="form-stack">
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              maxLength={16}
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => saveName(e.target.value)}
            />
          </div>

          {error && <div className="error-banner">{error}</div>}

          <button className="btn btn-primary" disabled={busy} onClick={createRoom} type="button">
            Create room
          </button>

          <div className="or-row">or join with code</div>

          <div className="field">
            <label htmlFor="code">Room code</label>
            <input
              id="code"
              maxLength={6}
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            />
          </div>

          <button className="btn btn-ghost" disabled={busy} onClick={joinRoom} type="button">
            Join room
          </button>
        </div>

        <div className="feature-row">
          <div className="feature">
            <strong>6 players</strong>
            <span>Private rooms</span>
          </div>
          <div className="feature">
            <strong>Share link</strong>
            <span>Friends join fast</span>
          </div>
          <div className="feature">
            <strong>Call ONE</strong>
            <span>Catch penalties</span>
          </div>
        </div>
      </div>
    </div>
  );
}
