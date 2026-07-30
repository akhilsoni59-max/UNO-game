import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AppState, LobbyState, GameState } from "../types";
import { socket } from "../socket";
import { Lobby } from "./Lobby";
import { GameTable } from "./GameTable";

export function Room() {
  const { code } = useParams();
  const [state, setState] = useState<AppState>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(true);
  const [name, setName] = useState(() => localStorage.getItem("cc_name") || "");
  const [needName, setNeedName] = useState(false);

  useEffect(() => {
    function onState(s: AppState) {
      setState(s);
      setJoining(false);
      setError("");
    }
    socket.on("state", onState);
    return () => {
      socket.off("state", onState);
    };
  }, []);

  useEffect(() => {
    if (!code) return;
    const saved = localStorage.getItem("cc_name") || "";
    if (!saved.trim()) {
      setNeedName(true);
      setJoining(false);
      return;
    }
    join(saved.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function join(n: string) {
    if (!code) return;
    setJoining(true);
    setError("");
    localStorage.setItem("cc_name", n);
    socket.emit(
      "join_room",
      { code: code.toUpperCase(), name: n },
      (res: { ok: boolean; error?: string }) => {
        if (!res?.ok) {
          setError(res?.error || "Could not join room");
          setJoining(false);
          setNeedName(true);
        }
      }
    );
  }

  if (needName && !state) {
    return (
      <div className="home">
        <div className="home-card">
          <div className="brand">
            <span className="brand-badge">Joining {code}</span>
            <h1>Enter your name</h1>
            <p>You’re joining via invite link.</p>
          </div>
          <div className="form-stack">
            <div className="field">
              <label htmlFor="jn">Your name</label>
              <input
                id="jn"
                maxLength={16}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && join(name.trim())}
              />
            </div>
            {error && <div className="error-banner">{error}</div>}
            <button className="btn btn-primary" type="button" disabled={!name.trim()} onClick={() => join(name.trim())}>
              Join room
            </button>
            <Link to="/" style={{ color: "var(--muted)", textAlign: "center" }}>
              Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (joining && !state) {
    return (
      <div className="home">
        <div className="home-card" style={{ textAlign: "center" }}>
          <h2>Joining room…</h2>
          <p style={{ color: "var(--muted)" }}>{code}</p>
        </div>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="home">
        <div className="home-card" style={{ textAlign: "center" }}>
          <h2>Couldn’t join</h2>
          <div className="error-banner" style={{ margin: "12px 0" }}>
            {error}
          </div>
          <Link className="btn btn-primary" to="/" style={{ display: "inline-block", textDecoration: "none" }}>
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (!state) return null;

  if (state.status === "lobby") {
    return <Lobby state={state as LobbyState} />;
  }

  return <GameTable state={state as GameState} />;
}
