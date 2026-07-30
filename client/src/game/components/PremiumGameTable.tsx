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
import { ConfirmDialog } from "./ConfirmDialog";
import { DeckPile } from "./DeckPile";
import { DiscardPile } from "./DiscardPile";
import { GameEventSimulator } from "./GameEventSimulator";
import { GameHUD } from "./GameHUD";
import { GameResults } from "./GameResults";
import { GameSettings, type ArenaTheme } from "./GameSettings";
import { GameShell } from "./GameShell";
import { GameTutorial } from "./GameTutorial";
import { LocalHand } from "./LocalHand";
import { OpponentHand } from "./OpponentHand";
import { PlayerSelector } from "./PlayerSelector";
import { ParticleLayer } from "./ParticleLayer";
import {
  HandSortControl,
  TableActionDock,
  TurnBeacon,
  type HandSortMode,
} from "./TurnExperience";
import type { GameVisualEvent } from "../events/GameVisualEvents";

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
  const gameStageRef = useRef<HTMLDivElement>(null);
  const pendingCardOrigins = useRef<Map<string, { x: number; y: number }>>(new Map());
  const layout = useGameScale(state.players.length, stageRef);
  const playableIds = usePlayableCards(state);
  const { reduced, scaleDuration } = useReducedMotion();
  const flying = useFlyingCards();
  const flyingRef = useRef(flying);
  flyingRef.current = flying;

  const [error, setError] = useState<{ id: number; message: string } | null>(null);
  const [toast, setToast] = useState("");
  const [colorPick, setColorPick] = useState<Card | null>(null);
  const [simColorPick, setSimColorPick] = useState(false);
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
  const [simAction, setSimAction] = useState<LastAction | null>(null);
  const [previewActiveId, setPreviewActiveId] = useState<string | null>(null);
  const [previewColor, setPreviewColor] = useState<Color | null>(null);
  const [previewWinner, setPreviewWinner] = useState<string | null>(null);
  const [dealing, setDealing] = useState(false);
  const [dealCounts, setDealCounts] = useState<Record<string, number>>({});
  const [connectionState, setConnectionState] = useState<"connected" | "reconnecting">(
    socket.connected ? "connected" : "reconnecting"
  );
  const [sortMode, setSortMode] = useState<HandSortMode>("dealt");
  const [dragCard, setDragCard] = useState<Card | null>(null);
  const [swapPick, setSwapPick] = useState<Card | null>(null);
  const [showTutorial, setShowTutorial] = useState(
    () => localStorage.getItem("cc_tutorial_seen") !== "1"
  );
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [arenaTheme, setArenaTheme] = useState<ArenaTheme>(
    () => (localStorage.getItem("cc_arena_theme") as ArenaTheme | null) ?? "ocean"
  );

  const lastProcessed = useRef<string | null>(null);
  const prevTurn = useRef<string | null>(null);
  const seatEls = useRef<Map<string, DOMRect>>(new Map());

  const fps = useFps(debug);
  const you = state.you;
  const cardW = layout.localHand.cardW;
  const cardH = layout.localHand.cardH;
  const activePlayer =
    state.players.find((player) => player.id === state.currentPlayerId) ?? state.players[0];
  const sortedHand = useMemo(() => {
    if (!you) return [];
    if (sortMode === "dealt") return you.hand;
    const colorOrder = { red: 0, yellow: 1, green: 2, blue: 3, black: 4 };
    return [...you.hand].sort((a, b) => {
      if (sortMode === "color") {
        const byColor = colorOrder[a.color] - colorOrder[b.color];
        if (byColor) return byColor;
      }
      const aValue = a.type === "number" ? a.value ?? 0 : 20;
      const bValue = b.type === "number" ? b.value ?? 0 : 20;
      return aValue - bValue || a.type.localeCompare(b.type);
    });
  }, [sortMode, you]);

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

  useEffect(() => {
    const connected = () => setConnectionState("connected");
    const disconnected = () => setConnectionState("reconnecting");
    socket.on("connect", connected);
    socket.on("disconnect", disconnected);
    return () => {
      socket.off("connect", connected);
      socket.off("disconnect", disconnected);
    };
  }, []);

  // Toast from last action message
  useEffect(() => {
    if (state.lastAction?.message) {
      setToast(state.lastAction.message);
      const t = setTimeout(() => setToast(""), animationTokens.toast);
      return () => clearTimeout(t);
    }
  }, [state.lastAction?.message, (state.lastAction as LastAction | null)?.id]);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [error]);

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

  const handleVisualEvent = useCallback((event: GameVisualEvent) => {
    if (event.type === "TURN_CHANGED") {
      setPreviewActiveId(event.playerId);
      setTimeout(() => setPreviewActiveId(null), 2400);
      return;
    }
    if (event.type === "COLOR_SELECTED") {
      setPreviewColor(event.color);
      sound.play("color");
      setTimeout(() => setPreviewColor(null), 2400);
      return;
    }
    if (event.type === "DIRECTION_CHANGED") {
      setEffect("reverse");
      sound.play("reverse");
      setTimeout(() => setEffect(null), animationTokens.reverseEffect);
      return;
    }
    if (event.type === "PLAYER_SKIPPED") {
      setPreviewActiveId(event.playerId);
      setEffect("skip");
      sound.play("skip");
      setTimeout(() => {
        setEffect(null);
        setPreviewActiveId(null);
      }, animationTokens.skipEffect);
      return;
    }
    if (event.type === "PLAYER_WON") {
      setPreviewWinner(event.playerId);
      return;
    }
    if (event.type === "DEAL_CARD") {
      setSimAction({ id: event.eventId, type: "start", playerId: event.playerId, card: event.card });
      return;
    }
    if (
      event.type === "PLAY_CARD" &&
      (event.card.type === "wild" || event.card.type === "wild4")
    ) {
      setSimColorPick(true);
      setColorPick(event.card);
      return;
    }
    setSimAction({
      id: event.eventId,
      type: event.type === "DRAW_CARD" ? "draw" : "play",
      playerId: event.playerId,
      card: event.card,
      count: event.type === "DRAW_CARD" ? event.count ?? 1 : undefined,
    });
  }, []);

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
    const action = simAction ?? (state.lastAction as LastAction | null);
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
        const isLocal = action.playerId === localId;
        const from =
          (isLocal ? pendingCardOrigins.current.get(action.card.id) : undefined) ??
          getSeatPoint(action.playerId);
        pendingCardOrigins.current.delete(action.card.id);
        const to = discard;
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
        setDealing(true);
        setDealCounts({});
        tableAnim.setInputLock(true);
        const flights: Promise<void>[] = [];
        const rounds = Math.min(7, Math.max(...state.players.map((player) => player.cardCount)));

        for (let round = 0; round < rounds; round++) {
          for (const { player } of seated) {
            if (round >= player.cardCount) continue;
            const isLocal = player.id === localId;
            const card = isLocal ? handSnapshot[round] : null;
            const key = `deal-${action.id}-${round}-${player.id}`;
            const dest = getSeatPoint(player.id);
            const w = isLocal ? cardW : gameTokens.opponentCardW;
            const h = isLocal ? cardH : gameTokens.opponentCardH;

            fly.upsert({
              key,
              card,
              faceDown: true,
              x: deck.x,
              y: deck.y,
              rotation: -5,
              scale: 0.86,
              w,
              h,
            });
            sound.play("deal", round % 4);

            flights.push(
              tableAnim.runDetached(async () => {
                await tableAnim.flyCard({
                  id: key,
                  from: deck,
                  to: dest,
                  duration: scaleDuration(reduced ? 90 : animationTokens.dealFlight),
                  startRotation: -8,
                  endRotation: isLocal ? 0 : 10,
                  startScale: 0.86,
                  endScale: isLocal ? 1 : 0.72,
                  faceDown: true,
                  flipAt: isLocal ? 0.72 : undefined,
                  onFlip: () => sound.play("flip"),
                  onUpdate: (frame) => {
                    fly.upsert({
                      key,
                      card,
                      faceDown: isLocal ? frame.faceDown : true,
                      x: frame.x,
                      y: frame.y,
                      rotation: frame.rotation,
                      scale: frame.scale,
                      w,
                      h,
                    });
                  },
                });
                fly.remove(key);
                sound.play("land", round % 3);
                setDealCounts((counts) => ({
                  ...counts,
                  [player.id]: (counts[player.id] ?? 0) + 1,
                }));
              })
            );
            await tableAnim.wait(scaleDuration(animationTokens.dealStagger));
          }
        }
        await Promise.all(flights);
        await tableAnim.wait(scaleDuration(animationTokens.drawHandSettle));
        setDealing(false);
        setDealCounts({});
        tableAnim.setInputLock(false);
      }
    };

    void tableAnim.enqueue(action.id, run);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate once per action id
  }, [state.lastAction?.id, simAction?.id]);

  function showError(message: string) {
    setError({ id: Date.now(), message });
  }

  function emitPlay(cardId: string, color?: Color, targetId?: string) {
    setError(null);
    sound.play("lift");
    socket.emit("play_card", { cardId, color, targetId }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) {
        showError(res?.error || "Invalid play");
        sound.play("invalid");
      }
    });
  }

  function play(card: Card) {
    if (inputLocked && !reduced) return;
    if (state.pendingDraw > 0 && !playableIds.has(card.id)) {
      showError("Draw pending cards first");
      sound.play("invalid");
      return;
    }
    if (card.type === "wild" || card.type === "wild4") {
      rememberCardOrigin(card.id);
      setColorPick(card);
      return;
    }
    if (state.rules.sevenZero && card.type === "number" && card.value === 7) {
      rememberCardOrigin(card.id);
      setSwapPick(card);
      return;
    }
    rememberCardOrigin(card.id);
    emitPlay(card.id);
  }

  function rememberCardOrigin(cardId: string) {
    const stage = gameStageRef.current;
    const card = stage?.querySelector<HTMLElement>(`.gc-hand-slot[data-card-id="${cardId}"]`);
    if (!stage || !card) return;
    const stageRect = stage.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    pendingCardOrigins.current.set(cardId, {
      x: cardRect.left - stageRect.left + cardRect.width / 2,
      y: cardRect.top - stageRect.top + cardRect.height / 2,
    });
  }

  function draw() {
    if (inputLocked && !reduced) return;
    setError(null);
    socket.emit("draw", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) {
        showError(res?.error || "Cannot draw");
        sound.play("invalid");
      }
    });
  }

  function pass() {
    setError(null);
    socket.emit("pass", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) showError(res?.error || "Cannot pass");
    });
  }

  function callOne() {
    socket.emit("call_one", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) showError(res?.error || "Cannot call ONE");
    });
  }

  function catchPlayer(targetId: string) {
    socket.emit("catch_one", { targetId }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) showError(res?.error || "Catch failed");
    });
  }

  function sendChat(text: string) {
    return new Promise<void>((resolve, reject) => {
      socket.emit(
        "chat_message",
        { text },
        (res: { ok: boolean; error?: string }) => {
          if (res?.ok) resolve();
          else reject(new Error(res?.error || "Message could not be sent"));
        }
      );
    });
  }

  function voteRematch() {
    socket.emit("vote_rematch", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) showError(res?.error || "Rematch vote failed");
    });
  }

  function leave() {
    socket.emit("leave_room", () => {
      rememberRoom(null);
      nav("/");
    });
  }

  const canDraw = !!you?.isTurn && (state.pendingDraw > 0 || !state.turnDrawTaken);
  const canPass = !!you?.isTurn && state.turnDrawTaken && state.pendingDraw === 0;
  const showOne =
    !!you && you.hand.length === 1 && !you.saidOne && !!state.oneCallDeadline;
  const tokenStyle = cssVarsFromTokens() as CSSProperties;

  // Suppress unused
  void seatEls;
  void animTick;

  return (
    <div className={`gc-root game-tokens theme-${arenaTheme}`} style={tokenStyle}>
      <GameHUD
        code={state.code}
        color={previewColor ?? state.currentColor}
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
        onOpenSettings={() => setSettingsOpen(true)}
        onLeave={() => setLeaveConfirm(true)}
        onOne={callOne}
        showOne={showOne}
        oneDeadline={state.oneCallDeadline}
        onPass={pass}
        canPass={canPass}
        onDrawPenalty={draw}
        pendingLabel={state.pendingDraw > 0 && you?.isTurn ? `Draw +${state.pendingDraw}` : undefined}
      />

      <GameShell
        playerCount={state.players.length}
        roomCode={state.code}
        messages={state.chat ?? []}
        currentPlayerId={you?.id}
        onSendChat={sendChat}
        rules={state.rules}
        actions={state.actionLog ?? []}
        connectionState={connectionState}
      >
        <div className="gc-stage-wrap" ref={stageRef}>
          {activePlayer && (
            <TurnBeacon
              activeName={activePlayer.name}
              isYourTurn={!!you?.isTurn}
              deadline={state.turnDeadline}
              duration={state.turnDurationMs}
              connected={activePlayer.connected !== false}
            />
          )}
          <div
            className="gc-stage"
            ref={gameStageRef}
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
          <div
            className="gc-center-console"
            style={{
              left: layout.center.x,
              top: layout.center.y,
              width: 410 * layout.scale,
              height: 238 * layout.scale,
            }}
            aria-hidden="true"
          >
            <span>ARENA CONTROL</span>
            <i />
          </div>

          <DirectionIndicator
            pos={layout.direction}
            direction={state.direction}
            spinning={effect === "reverse"}
          />
          <ColorIndicator pos={layout.colorIndicator} color={previewColor ?? state.currentColor} />

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
            dragActive={!!dragCard}
            onDropCard={() => {
              const card = dragCard;
              setDragCard(null);
              if (card) play(card);
            }}
          />

          <TableActionDock
            pos={{ x: layout.center.x, y: layout.center.y + cardH * 0.92 }}
            isTurn={!!you?.isTurn}
            pendingDraw={state.pendingDraw}
            canDraw={canDraw && !inputLocked}
            canPass={canPass && !inputLocked}
            playableCount={playableIds.size}
            onDraw={draw}
            onPass={pass}
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
                visibleCount={dealing ? dealCounts[player.id] ?? 0 : undefined}
                activeOverride={previewActiveId ? previewActiveId === player.id : undefined}
                onCatch={
                  player.cardCount === 1 && !player.saidOne
                    ? () => catchPlayer(player.id)
                    : undefined
                }
              />
            );
          })}

          {you && (
            <>
              <div
                className={`gc-local-player ${previewActiveId ? previewActiveId === you.id ? "is-turn" : "" : you.isTurn ? "is-turn" : ""}`}
                style={{
                  left: layout.localHand.center.x,
                  top: layout.localHand.center.y - cardH * 0.7,
                }}
              >
                <span className="gc-local-avatar">{you.name.slice(0, 1).toUpperCase()}</span>
                <span className="gc-local-copy">
                  <strong>{you.name}</strong>
                  <small>{you.hand.length} cards</small>
                </span>
              </div>
              <LocalHand
                cards={sortedHand}
                playableIds={playableIds}
                isTurn={
                  previewActiveId
                    ? previewActiveId === you.id
                    : you.isTurn || state.rules.jumpIn
                }
                inputLocked={inputLocked}
                center={layout.localHand.center}
                fanWidth={layout.localHand.fanWidth}
                cardW={cardW}
                cardH={cardH}
                hiddenIds={hiddenHandIds}
                visibleCount={dealing ? dealCounts[you.id] ?? 0 : undefined}
                onPlay={play}
                onInvalid={() => showError("That card cannot be played")}
                onBusy={() => showError("Finishing the previous move…")}
                onDragStart={(card) => setDragCard(card)}
                onDragEnd={() => setDragCard(null)}
              />
              <HandSortControl
                pos={{
                  x: Math.max(
                    72,
                    layout.localHand.center.x - layout.localHand.fanWidth / 2 - 72
                  ),
                  y: layout.localHand.center.y,
                }}
                mode={sortMode}
                onChange={setSortMode}
              />
            </>
          )}

          <CardTransferLayer cards={flying.list} />
          <ParticleLayer burst={burst} />

          {toast && <div className="gc-toast">{toast}</div>}
          {error && (
            <div
              key={error.id}
              className="gc-error"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="gc-error-mark" aria-hidden="true">!</span>
              <span>{error.message}</span>
            </div>
          )}
          {oneFlash && <div className="gc-one-flash">ONE</div>}
          </div>
        </div>
      </GameShell>

      <ColorSelector
        open={!!colorPick}
        onPick={(c) => {
          if (!colorPick) return;
          const id = colorPick.id;
          if (simColorPick) {
            setPreviewColor(c);
            setSimAction({
              id: `visual-wild-${Date.now()}`,
              type: "play",
              playerId: you?.id,
              card: colorPick,
              color: c,
            });
            setSimColorPick(false);
            setColorPick(null);
            return;
          }
          setColorPick(null);
          emitPlay(id, c);
        }}
        onCancel={() => {
          if (colorPick) pendingCardOrigins.current.delete(colorPick.id);
          setSimColorPick(false);
          setColorPick(null);
        }}
      />

      <GameResults
        open={state.status === "finished" || !!previewWinner}
        youWin={(previewWinner ?? state.winnerId) === you?.id}
        winnerName={state.players.find((p) => p.id === (previewWinner ?? state.winnerId))?.name || "Player"}
        players={state.players}
        ranking={state.ranking}
        currentPlayerId={you?.id}
        rematchVotes={state.rematchVotes ?? []}
        onVoteRematch={voteRematch}
      />

      <PlayerSelector
        card={swapPick}
        players={state.players}
        onPick={(targetId) => {
          if (!swapPick) return;
          const card = swapPick;
          setSwapPick(null);
          emitPlay(card.id, undefined, targetId);
        }}
        onCancel={() => {
          if (swapPick) pendingCardOrigins.current.delete(swapPick.id);
          setSwapPick(null);
        }}
      />

      {showTutorial && state.status === "playing" && (
        <GameTutorial onFinish={() => setShowTutorial(false)} />
      )}

      <ConfirmDialog
        open={leaveConfirm}
        title="Leave this round?"
        message="Your seat will remain reserved for reconnecting, but the current match will continue without you."
        confirmLabel="Leave table"
        onCancel={() => setLeaveConfirm(false)}
        onConfirm={() => {
          setLeaveConfirm(false);
          leave();
        }}
      />

      <GameSettings
        open={settingsOpen}
        theme={arenaTheme}
        onTheme={(theme) => {
          setArenaTheme(theme);
          localStorage.setItem("cc_arena_theme", theme);
        }}
        onClose={() => setSettingsOpen(false)}
      />

      {debug && import.meta.env.DEV && (
        <GameEventSimulator players={state.players} localPlayerId={you?.id} onEvent={handleVisualEvent} />
      )}

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
