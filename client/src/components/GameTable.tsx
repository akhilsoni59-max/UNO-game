import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Card, Color, GameState } from "../types";
import { socket } from "../socket";
import { CardView, DrawPile } from "./CardView";

function canPlayLocal(card: Card, top: Card | null, currentColor: Color, isTurn: boolean, pendingDraw: number) {
  if (!isTurn || pendingDraw > 0) return false;
  if (!top) return true;
  if (card.type === "wild" || card.type === "wild4") return true;
  if (card.color === currentColor) return true;
  if (card.type === "number" && top.type === "number" && card.value === top.value) return true;
  if (card.type !== "number" && card.type !== "wild" && card.type !== "wild4" && card.type === top.type) return true;
  return false;
}

export function GameTable({ state }: { state: GameState }) {
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [oneFlash, setOneFlash] = useState(false);
  const [colorPick, setColorPick] = useState<Card | null>(null);

  const you = state.you;
  const opponents = state.players.filter((p) => !p.isYou);

  useEffect(() => {
    if (state.lastAction?.message) {
      setToast(state.lastAction.message);
      const t = setTimeout(() => setToast(""), 2200);
      return () => clearTimeout(t);
    }
  }, [state.lastAction]);

  useEffect(() => {
    const onEffect = (action: { type: string }) => {
      if (action?.type === "callOne") {
        setOneFlash(true);
        setTimeout(() => setOneFlash(false), 1000);
      }
    };
    socket.on("effect", onEffect);
    return () => {
      socket.off("effect", onEffect);
    };
  }, []);

  const playableIds = useMemo(() => {
    if (!you) return new Set<string>();
    const set = new Set<string>();
    for (const c of you.hand) {
      if (canPlayLocal(c, state.topCard, state.currentColor, you.isTurn, state.pendingDraw)) {
        set.add(c.id);
      }
    }
    return set;
  }, [you, state.topCard, state.currentColor, state.pendingDraw]);

  function play(card: Card) {
    if (!you?.isTurn) return;
    if (state.pendingDraw > 0) {
      setError("Draw the pending cards first");
      return;
    }
    if (!playableIds.has(card.id)) return;

    if (card.type === "wild" || card.type === "wild4") {
      setColorPick(card);
      return;
    }
    emitPlay(card.id);
  }

  function emitPlay(cardId: string, color?: Color) {
    setError("");
    socket.emit("play_card", { cardId, color }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setError(res?.error || "Invalid play");
    });
  }

  function draw() {
    setError("");
    socket.emit("draw", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setError(res?.error || "Cannot draw");
    });
  }

  function pass() {
    setError("");
    socket.emit("pass", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setError(res?.error || "Cannot pass");
    });
  }

  function callOne() {
    socket.emit("call_one", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setError(res?.error || "Cannot call ONE");
    });
  }

  function catchPlayer(targetId: string) {
    socket.emit("catch_one", { targetId }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setError(res?.error || "Catch failed");
    });
  }

  function rematch() {
    socket.emit("rematch", () => {});
  }

  const showOneBtn = you && you.hand.length === 1 && !you.saidOne;
  const canDraw = you?.isTurn && (state.pendingDraw > 0 || !state.turnDrawTaken);
  const canPass = you?.isTurn && state.turnDrawTaken && state.pendingDraw === 0;

  return (
    <div className="table-screen">
      <div className="table-topbar">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="pill">Room {state.code}</span>
          <span className="pill">
            Color <span className={`color-dot ${state.currentColor}`} /> {state.currentColor}
          </span>
          <span className="pill">Dir {state.direction === 1 ? "→" : "←"}</span>
          {state.pendingDraw > 0 && (
            <span className="pill" style={{ color: "#ffb4bc" }}>
              Draw stack +{state.pendingDraw}
            </span>
          )}
        </div>
        <span className="pill">Deck {state.deckCount}</span>
      </div>

      <div className="felt">
        <AnimatePresence>
          {toast && (
            <motion.div
              className="action-toast"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="opponents">
          {opponents.map((p) => (
            <div key={p.id} className={`opponent ${p.isTurn ? "active" : ""}`}>
              <div className="oname">{p.name}</div>
              <div className="ocount">
                {p.cardCount} card{p.cardCount === 1 ? "" : "s"}
                {p.saidOne ? " · ONE!" : ""}
              </div>
              <div className="opponent-cards">
                {Array.from({ length: Math.min(p.cardCount, 6) }).map((_, i) => (
                  <div key={i} style={{ marginLeft: i === 0 ? 0 : -28 }}>
                    <CardView faceDown size="sm" />
                  </div>
                ))}
              </div>
              {p.cardCount === 1 && !p.saidOne && (
                <button
                  className="btn btn-danger"
                  style={{ marginTop: 8, padding: "6px 10px", fontSize: "0.75rem" }}
                  type="button"
                  onClick={() => catchPlayer(p.id)}
                >
                  Catch!
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="center-area">
          <div className="pile">
            <span className="pile-label">Draw</span>
            <DrawPile
              count={state.deckCount}
              onClick={canDraw ? draw : undefined}
              disabled={!canDraw}
            />
          </div>

          <div className="pile">
            <span className="pile-label">Discard</span>
            <AnimatePresence mode="popLayout">
              {state.topCard && (
                <motion.div
                  key={state.topCard.id}
                  initial={{ scale: 0.6, rotate: -18, y: 40, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                >
                  <CardView card={state.topCard} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="hand-area">
          <div className="hand-toolbar">
            {you?.isTurn ? (
              <span className="turn-banner">Your turn</span>
            ) : (
              <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                Waiting for {state.players.find((p) => p.isTurn)?.name || "player"}…
              </span>
            )}
            {showOneBtn && (
              <button className="btn btn-one" type="button" onClick={callOne}>
                ONE!
              </button>
            )}
            {canPass && (
              <button className="btn btn-ghost" type="button" onClick={pass}>
                Pass
              </button>
            )}
            {state.pendingDraw > 0 && you?.isTurn && (
              <button className="btn btn-danger" type="button" onClick={draw}>
                Draw +{state.pendingDraw}
              </button>
            )}
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="hand-row">
            <AnimatePresence initial={false}>
              {you?.hand.map((card, i) => {
                const playable = playableIds.has(card.id);
                const fan = (i - (you.hand.length - 1) / 2) * 4;
                return (
                  <motion.div
                    key={card.id}
                    className={`hand-card-wrap ${playable ? "playable" : "unplayable"}`}
                    style={{ zIndex: i, rotate: fan }}
                    layout
                    initial={{ y: 80, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -120, opacity: 0, scale: 0.6, rotate: fan - 20 }}
                    transition={{ type: "spring", stiffness: 280, damping: 24 }}
                  >
                    <CardView
                      card={card}
                      onClick={() => play(card)}
                      disabled={!playable}
                      glow={playable && !!you?.isTurn}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {oneFlash && <div className="one-flash">ONE!</div>}

      {colorPick && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Pick a color</h2>
            <p>Choose the next color for the table</p>
            <div className="color-grid">
              {(["red", "yellow", "green", "blue"] as Color[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-pick ${c}`}
                  onClick={() => {
                    const id = colorPick.id;
                    setColorPick(null);
                    emitPlay(id, c);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 14, width: "100%" }}
              type="button"
              onClick={() => setColorPick(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.status === "finished" && (
        <div className="modal-backdrop">
          <div className="modal winner-modal">
            <h2>
              {state.winnerId === you?.id
                ? "You win!"
                : `${state.players.find((p) => p.id === state.winnerId)?.name || "Someone"} wins!`}
            </h2>
            <p>Thanks for playing ChromaCards</p>
            {state.hostId === you?.id ? (
              <button className="btn btn-primary" type="button" onClick={rematch}>
                Back to lobby
              </button>
            ) : (
              <p style={{ marginTop: 8 }}>Host can return everyone to the lobby</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
