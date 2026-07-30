import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { Card, Color, GameState } from "../../types";
import { rememberRoom } from "../../identity";
import { socket } from "../../socket";
import { tableAnim } from "../animation/AnimationOrchestrator";
import { CardTransferLayer, PerfOverlay, useFlyingCards, useFps } from "../animation/CardTransferLayer";
import { usePlayableCards } from "../hooks/usePlayableCards";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { seatPlayersClockwise, type SeatRole } from "../layout/TableLayoutEngine";
import { useGameScale } from "../layout/useGameScale";
import { sound } from "../sound/SoundManager";
import { animationTokens } from "../tokens/animationTokens";
import { cssVarsFromTokens, gameTokens } from "../tokens/gameTokens";
import { ColorSelector } from "./ColorSelector";
import { ColorIndicator, DirectionIndicator } from "./DirectionIndicator";
import { DeckPile } from "./DeckPile";
import { DiscardPile } from "./DiscardPile";
import { GameHUD } from "./GameHUD";
import { GameResults } from "./GameResults";
import { LocalHand } from "./LocalHand";
import { OpponentHand } from "./OpponentHand";
import { ParticleLayer } from "./ParticleLayer";

interface LastAction {
  id?: string;
  type: string;
  message?: string;
  playerId?: string;
  targetId?: string;
  card?: Card;
  color?: Color;
  count?: number;
}

export function PremiumGameTable({ state }: { state: GameState }) {
  const nav = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const layout = useGameScale(state.players.length, stageRef);
  const playableIds = usePlayableCards(state);
  const { reduced, scaleDuration } = useReducedMotion();
  const flying = useFlyingCards();
  const flyingRef = useRef(flying);
  flyingRef.current = flying;

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [colorPick, setColorPick] = useState<Card | null>(null);
  const [effect, setEffect] = useState<"skip" | "reverse" | "wild" | null>(null);
  const [penaltyBadge, setPenaltyBadge] = useState<string | null>(null);
  const [oneFlash, setOneFlash] = useState(false);
  const [deckBounce, setDeckBounce] = useState(false);
  const [hideDiscardTop, setHideDiscardTop] = useState(false);
  const [hiddenHandIds, setHiddenHandIds] = useState<Set<string>>(new Set());
  const [inputLocked, setInputLocked] = useState(false);
  const [burst, setBurst] = useState<{ x: number; y: number; color: string } | null>(null);
  const [muted, setMuted] = useState(() => sound.preferences.muted);
  const [animTick, setAnimTick] = useState(0);
  const [debug] = useState(() => new URLSearchParams(location.search).has("debug"));

  const lastProcessed = useRef<string | null>(null);
  const prevTurn = useRef<string | null>(null);
  const seatEls = useRef<Map<string, DOMRect>>(new Map());

  const fps = useFps(debug);
  const you = state.you;
  const cardW = layout.localHand.cardW;
  const cardH = layout.localHand.cardH;

  const seated = useMemo(
    () => seatPlayersClockwise(state.players, you?.id),
    [state.players, you?.id]
  );

  const seatByPlayerId = useMemo(() => {
    const m = new Map<string, (typeof seated)[0]>();
    for (const s of seated) m.set(s.player.id, s);
    return m;
  }, [seated]);

  const layoutSeatByRole = useMemo(() => {
    const m = new Map<SeatRole, (typeof layout.seats)[0]>();
    for (const s of layout.seats) m.set(s.role, s);
    return m;
  }, [layout.seats]);

  useEffect(() => {
    const unsub = tableAnim.onChange(() => {
      setInputLocked(tableAnim.isBusy);
      setAnimTick((t) => t + 1);
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    void sound.unlock();
  }, []);

  // Toast from last action message
  useEffect(() => {
    if (state.lastAction?.message) {
      setToast(state.lastAction.message);
      const t = setTimeout(() => setToast(""), animationTokens.toast);
      return () => clearTimeout(t);
    }
  }, [state.lastAction?.message, (state.lastAction as LastAction | null)?.id]);

  // Turn change sound
  useEffect(() => {
    const cur = state.currentPlayerId;
    if (prevTurn.current && cur && prevTurn.current !== cur) {
      if (you?.isTurn) sound.play("turn");
    }
    prevTurn.current = cur ?? null;
  }, [state.currentPlayerId, you?.isTurn]);

  const getSeatPoint = useCallback(
    (playerId: string) => {
      const entry = seatByPlayerId.get(playerId);
      if (!entry) return layout.center;
      const seat = layoutSeatByRole.get(entry.role);
      return seat?.anchor ?? layout.center;
    },
    [seatByPlayerId, layoutSeatByRole, layout.center]
  );

  const playEffectAfterLand = useCallback(
    async (action: LastAction) => {
      const card = action.card;
      if (!card) return;
      if (card.type === "skip") {
        setEffect("skip");
        sound.play("skip");
        await tableAnim.wait(scaleDuration(animationTokens.skipEffect));
        setEffect(null);
      } else if (card.type === "reverse") {
        setEffect("reverse");
        sound.play("reverse");
        await tableAnim.wait(scaleDuration(animationTokens.reverseEffect));
        setEffect(null);
      } else if (card.type === "draw2") {
        setPenaltyBadge("+2");
        sound.play("penalty");
        setDeckBounce(true);
        await tableAnim.wait(scaleDuration(400));
        setPenaltyBadge(null);
        setDeckBounce(false);
      } else if (card.type === "wild4") {
        setPenaltyBadge("+4");
        sound.play("penalty");
        setDeckBounce(true);
        setEffect("wild");
        await tableAnim.wait(scaleDuration(400));
        setPenaltyBadge(null);
        setDeckBounce(false);
        setEffect(null);
      } else if (card.type === "wild") {
        setEffect("wild");
        await tableAnim.wait(scaleDuration(animationTokens.wildExpand));
        setEffect(null);
      }
    },
    [scaleDuration]
  );

  // Semantic action animations from server lastAction (deduped by action.id)
  useEffect(() => {
    const action = state.lastAction as LastAction | null;
    if (!action?.id) return;
    if (lastProcessed.current === action.id) return;
    lastProcessed.current = action.id;

    // Skip cosmetics if already animated (reconnect / strict mode double-mount uses markSeen inside enqueue)
    if (tableAnim.hasSeen(action.id)) return;

    const fly = flyingRef.current;
    const deck = { ...layout.deck };
    const discard = { ...layout.discard };
    const localId = you?.id;
    const handSnapshot = you?.hand ? [...you.hand] : [];

    const run = async () => {
      if (action.type === "play" && action.card && action.playerId) {
        const from = getSeatPoint(action.playerId);
        const to = discard;
        const isLocal = action.playerId === localId;
        const actionId = action.id!;
        const key = `fly-play-${actionId}`;
        const endRot = ((actionId.charCodeAt(actionId.length - 1) % 17) - 8) * 0.8;

        if (isLocal && action.card) {
          setHiddenHandIds((s) => new Set(s).add(action.card!.id));
        }
        setHideDiscardTop(true);

        const w = isLocal ? cardW : gameTokens.opponentCardW;
        const h = isLocal ? cardH : gameTokens.opponentCardH;

        fly.upsert({
          key,
          card: action.card,
          faceDown: false,
          x: from.x,
          y: from.y,
          rotation: 0,
          scale: isLocal ? 1 : 0.7,
          w,
          h,
        });

        sound.play("slide");
        tableAnim.setInputLock(true);

        await tableAnim.flyCard({
          id: key,
          from,
          to,
          duration: scaleDuration(reduced ? 80 : animationTokens.playFlight),
          startRotation: isLocal ? 0 : 20,
          endRotation: endRot,
          startScale: isLocal ? 1.05 : 0.7,
          endScale: 1,
          faceDown: false,
          onUpdate: (f) => {
            fly.upsert({
              key,
              card: action.card,
              faceDown: false,
              x: f.x,
              y: f.y,
              rotation: f.rotation,
              scale: f.scale,
              w,
              h,
            });
          },
        });

        sound.play("land");
        sound.play("play");
        fly.remove(key);
        setHideDiscardTop(false);
        if (isLocal && action.card) {
          setHiddenHandIds((s) => {
            const n = new Set(s);
            n.delete(action.card!.id);
            return n;
          });
        }

        setBurst({
          x: to.x,
          y: to.y,
          color:
            action.card.color === "black"
              ? gameTokens.cardBackEmblem
              : action.card.color === "red"
                ? gameTokens.colorRed
                : action.card.color === "yellow"
                  ? gameTokens.colorYellow
                  : action.card.color === "green"
                    ? gameTokens.colorGreen
                    : gameTokens.colorBlue,
        });
        setTimeout(() => setBurst(null), 400);

        await playEffectAfterLand(action);
        tableAnim.setInputLock(false);
        return;
      }

      if (action.type === "draw" && action.playerId) {
        const count = Math.min(action.count || 1, 8);
        const isLocal = action.playerId === localId;
        const dest = getSeatPoint(action.playerId);
        tableAnim.setInputLock(true);

        for (let i = 0; i < count; i++) {
          const key = `fly-draw-${action.id}-${i}`;
          const w = isLocal ? cardW : gameTokens.opponentCardW;
          const h = isLocal ? cardH : gameTokens.opponentCardH;
          const localCard =
            isLocal && i === count - 1 && handSnapshot.length
              ? handSnapshot[handSnapshot.length - 1]
              : null;

          fly.upsert({
            key,
            card: localCard,
            faceDown: true,
            x: deck.x,
            y: deck.y,
            rotation: 0,
            scale: 1,
            w,
            h,
          });

          sound.play("draw", i % 4);
          setDeckBounce(true);
          setTimeout(() => setDeckBounce(false), 120);

          await tableAnim.flyCard({
            id: key,
            from: deck,
            to: dest,
            duration: scaleDuration(reduced ? 90 : animationTokens.drawFlight),
            startRotation: -8,
            endRotation: isLocal ? 0 : 15,
            startScale: 1,
            endScale: isLocal ? 1 : 0.65,
            faceDown: true,
            flipAt: isLocal && localCard ? 0.68 : undefined,
            onFlip: () => sound.play("flip"),
            onUpdate: (f) => {
              fly.upsert({
                key,
                card: localCard,
                faceDown: isLocal && localCard ? f.faceDown : true,
                x: f.x,
                y: f.y,
                rotation: f.rotation,
                scale: f.scale,
                w,
                h,
              });
            },
          });

          sound.play("land");
          fly.remove(key);
          if (i < count - 1) await tableAnim.wait(scaleDuration(animationTokens.drawStagger));
        }
        tableAnim.setInputLock(false);
        return;
      }

      if (action.type === "callOne") {
        setOneFlash(true);
        sound.play("turn");
        await tableAnim.wait(scaleDuration(900));
        setOneFlash(false);
        return;
      }

      if (action.type === "start") {
        sound.play("deal");
      }
    };

    void tableAnim.enqueue(action.id, run);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate once per action id
  }, [state.lastAction?.id]);

  function emitPlay(cardId: string, color?: Color) {
    setError("");
    sound.play("lift");
    socket.emit("play_card", { cardId, color }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) {
        setError(res?.error || "Invalid play");
        sound.play("invalid");
      }
    });
  }

  function play(card: Card) {
    if (inputLocked && !reduced) return;
    if (state.pendingDraw > 0) {
      setError("Draw pending cards first");
      sound.play("invalid");
      return;
    }
    if (card.type === "wild" || card.type === "wild4") {
      setColorPick(card);
      return;
    }
    emitPlay(card.id);
  }

  function draw() {
    if (inputLocked && !reduced) return;
    setError("");
    socket.emit("draw", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) {
        setError(res?.error || "Cannot draw");
        sound.play("invalid");
      }
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

  function leave() {
    socket.emit("leave_room", () => {
      rememberRoom(null);
      nav("/");
    });
  }

  const canDraw = !!you?.isTurn && (state.pendingDraw > 0 || !state.turnDrawTaken);
  const canPass = !!you?.isTurn && state.turnDrawTaken && state.pendingDraw === 0;
  const showOne = !!you && you.hand.length === 1 && !you.saidOne;
  const tokenStyle = cssVarsFromTokens() as CSSProperties;

  // Suppress unused
  void seatEls;
  void animTick;

  return (
    <div className="gc-root game-tokens" style={tokenStyle}>
      <GameHUD
        code={state.code}
        color={state.currentColor}
        direction={state.direction}
        pendingDraw={state.pendingDraw}
        deckCount={state.deckCount}
        isYourTurn={!!you?.isTurn}
        muted={muted}
        onToggleMute={() => {
          const next = !muted;
          setMuted(next);
          sound.setPrefs({ muted: next });
        }}
        onLeave={leave}
        onOne={callOne}
        showOne={showOne}
        onPass={pass}
        canPass={canPass}
        onDrawPenalty={draw}
        pendingLabel={state.pendingDraw > 0 && you?.isTurn ? `Draw +${state.pendingDraw}` : undefined}
      />

      <div className="gc-stage-wrap" ref={stageRef}>
        <div
          className="gc-stage"
          style={{ width: layout.stageW, height: layout.stageH }}
        >
          {/* Table surface */}
          <div
            className="gc-table-oval"
            style={{
              left: layout.center.x,
              top: layout.center.y,
              width: layout.tableRx * 2,
              height: layout.tableRy * 2,
            }}
          />
          <div className="gc-table-vignette" />

          <DirectionIndicator
            pos={layout.direction}
            direction={state.direction}
            spinning={effect === "reverse"}
          />
          <ColorIndicator pos={layout.colorIndicator} color={state.currentColor} />

          {penaltyBadge && (
            <div
              className="gc-penalty-badge"
              style={{ left: layout.center.x, top: layout.center.y }}
            >
              {penaltyBadge}
            </div>
          )}

          {effect === "skip" && state.currentPlayerId && (
            <div
              className="gc-skip-pulse"
              style={{
                left: getSeatPoint(state.currentPlayerId).x,
                top: getSeatPoint(state.currentPlayerId).y,
              }}
            />
          )}

          <DeckPile
            pos={layout.deck}
            count={state.deckCount}
            cardW={cardW * 0.92}
            cardH={cardH * 0.92}
            canDraw={canDraw && !inputLocked}
            onDraw={draw}
            bounce={deckBounce}
          />

          <DiscardPile
            pos={layout.discard}
            top={state.topCard}
            cardW={cardW * 0.92}
            cardH={cardH * 0.92}
            salt={state.topCard?.id}
            hidden={hideDiscardTop}
          />

          {seated.map(({ player, role }) => {
            if (role === "local") return null;
            const seat = layoutSeatByRole.get(role);
            if (!seat) return null;
            return (
              <OpponentHand
                key={player.id}
                player={player}
                seat={seat}
                onCatch={
                  player.cardCount === 1 && !player.saidOne
                    ? () => catchPlayer(player.id)
                    : undefined
                }
              />
            );
          })}

          {you && (
            <LocalHand
              cards={you.hand}
              playableIds={playableIds}
              isTurn={you.isTurn}
              inputLocked={inputLocked}
              center={layout.localHand.center}
              fanWidth={layout.localHand.fanWidth}
              cardW={cardW}
              cardH={cardH}
              hiddenIds={hiddenHandIds}
              onPlay={play}
              onInvalid={() => setError("That card cannot be played")}
            />
          )}

          <CardTransferLayer cards={flying.list} />
          <ParticleLayer burst={burst} />

          {toast && <div className="gc-toast">{toast}</div>}
          {error && <div className="gc-error">{error}</div>}
          {oneFlash && <div className="gc-one-flash">ONE</div>}
        </div>
      </div>

      <ColorSelector
        open={!!colorPick}
        onPick={(c) => {
          if (!colorPick) return;
          const id = colorPick.id;
          setColorPick(null);
          emitPlay(id, c);
        }}
        onCancel={() => setColorPick(null)}
      />

      <GameResults
        open={state.status === "finished"}
        youWin={state.winnerId === you?.id}
        winnerName={state.players.find((p) => p.id === state.winnerId)?.name || "Player"}
        isHost={state.hostId === you?.id}
        onRematch={rematch}
      />

      <PerfOverlay
        show={debug}
        fps={fps}
        flying={tableAnim.flyingCount}
        tweens={tableAnim.activeTweens}
        queued={tableAnim.queued}
      />
    </div>
  );
}
