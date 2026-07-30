/** ChromaCards — original 4-color shedding game rules (server-authoritative). */

export const COLORS = ["red", "yellow", "green", "blue"];
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 1;
export const HAND_SIZE = 7;

/**
 * @typedef {'red'|'yellow'|'green'|'blue'} Color
 * @typedef {'number'|'skip'|'reverse'|'draw2'|'wild'|'wild4'} CardType
 * @typedef {{ id: string, color: Color|'black', type: CardType, value?: number }} Card
 */

let cardSeq = 0;
function nextId() {
  cardSeq += 1;
  return `c${cardSeq}`;
}

export function createDeck() {
  cardSeq = 0;
  /** @type {Card[]} */
  const deck = [];

  for (const color of COLORS) {
    deck.push({ id: nextId(), color, type: "number", value: 0 });
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: nextId(), color, type: "number", value: n });
      deck.push({ id: nextId(), color, type: "number", value: n });
    }
    for (const type of ["skip", "reverse", "draw2"]) {
      deck.push({ id: nextId(), color, type });
      deck.push({ id: nextId(), color, type });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: nextId(), color: "black", type: "wild" });
    deck.push({ id: nextId(), color: "black", type: "wild4" });
  }
  return shuffle(deck);
}

export function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isWild(card) {
  return card.type === "wild" || card.type === "wild4";
}

export function canPlay(card, top, currentColor) {
  if (!top) return true;
  if (isWild(card)) return true;
  if (card.color === currentColor) return true;
  if (card.type === "number" && top.type === "number" && card.value === top.value) return true;
  if (card.type !== "number" && !isWild(card) && card.type === top.type) return true;
  return false;
}

function drawFromDeck(state, n) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length <= 1) break;
      const top = state.discard.pop();
      state.deck = shuffle(state.discard);
      state.discard = top ? [top] : [];
    }
    if (state.deck.length === 0) break;
    drawn.push(state.deck.pop());
  }
  return drawn;
}

function nextIndex(state, from, steps = 1) {
  const alive = state.players.filter((p) => !p.eliminated);
  if (alive.length === 0) return from;
  let idx = from;
  let remaining = steps;
  while (remaining > 0) {
    idx = (idx + state.direction + state.players.length) % state.players.length;
    if (!state.players[idx].eliminated) remaining -= 1;
  }
  return idx;
}

function publicCard(card) {
  return card;
}

/**
 * Create initial in-progress game state.
 * @param {{ id: string, name: string }[]} players
 */
export function startGame(players) {
  let deck = createDeck();
  const hands = players.map(() => {
    const hand = deck.splice(0, HAND_SIZE);
    return hand;
  });

  // First non-wild as start card
  let startIdx = deck.findIndex((c) => !isWild(c));
  if (startIdx === -1) startIdx = 0;
  const [top] = deck.splice(startIdx, 1);
  const discard = [top];

  const state = {
    status: "playing",
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      hand: hands[i],
      saidOne: false,
      eliminated: false,
    })),
    deck,
    discard,
    currentColor: top.color === "black" ? "red" : top.color,
    currentPlayerIndex: 0,
    direction: 1,
    pendingDraw: 0,
    winnerId: null,
    ranking: [],
    lastAction: { type: "start", message: "Game started" },
    mustCallOne: null, // playerId who just went to 1 and must call
    turnDrawTaken: false,
  };

  // Apply start action effects lightly
  if (top.type === "reverse") {
    state.direction = -1;
  } else if (top.type === "skip") {
    state.currentPlayerIndex = nextIndex(state, 0, 1);
  } else if (top.type === "draw2") {
    state.pendingDraw = 2;
  }

  return state;
}

export function getPlayableCards(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  if (state.players[state.currentPlayerIndex]?.id !== playerId) return [];
  const top = state.discard[state.discard.length - 1];
  return player.hand.filter((c) => canPlay(c, top, state.currentColor));
}

/**
 * Apply a play. Returns { ok, error?, events? }
 */
export function playCard(state, playerId, cardId, chosenColor) {
  if (state.status !== "playing") return { ok: false, error: "Game not active" };
  const pIndex = state.players.findIndex((p) => p.id === playerId);
  if (pIndex !== state.currentPlayerIndex) return { ok: false, error: "Not your turn" };

  const player = state.players[pIndex];
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return { ok: false, error: "Card not in hand" };

  const card = player.hand[cardIndex];
  const top = state.discard[state.discard.length - 1];

  // If there is pending draw stack, only draw2/wild4 that stacks — we keep simple: must draw first
  if (state.pendingDraw > 0) {
    return { ok: false, error: "You must draw pending cards first" };
  }

  if (!canPlay(card, top, state.currentColor)) {
    return { ok: false, error: "Illegal play" };
  }

  if (isWild(card)) {
    if (!chosenColor || !COLORS.includes(chosenColor)) {
      return { ok: false, error: "Choose a color" };
    }
  }

  player.hand.splice(cardIndex, 1);
  state.discard.push(card);
  state.turnDrawTaken = false;

  if (isWild(card)) {
    state.currentColor = chosenColor;
  } else {
    state.currentColor = card.color;
  }

  // One-card call tracking
  if (player.hand.length === 1) {
    player.saidOne = false;
    state.mustCallOne = playerId;
  } else {
    if (player.hand.length !== 1) player.saidOne = false;
    if (state.mustCallOne === playerId) state.mustCallOne = null;
  }

  let skipNext = false;
  let extraSkip = 0;

  if (card.type === "skip") {
    skipNext = true;
  } else if (card.type === "reverse") {
    state.direction *= -1;
    const active = state.players.filter((p) => !p.eliminated).length;
    if (active === 2) skipNext = true; // reverse acts as skip in 2p
  } else if (card.type === "draw2") {
    state.pendingDraw += 2;
    skipNext = true;
  } else if (card.type === "wild4") {
    state.pendingDraw += 4;
    skipNext = true;
  }

  // Win check
  if (player.hand.length === 0) {
    state.ranking.push(playerId);
    player.eliminated = true;
    const remaining = state.players.filter((p) => !p.eliminated && p.hand.length > 0);
    if (remaining.length <= 1) {
      if (remaining[0]) state.ranking.push(remaining[0].id);
      state.status = "finished";
      state.winnerId = state.ranking[0];
      state.lastAction = {
        type: "win",
        playerId,
        card: publicCard(card),
        message: `${player.name} wins!`,
      };
      return { ok: true };
    }
    // continue without this player
    if (state.currentPlayerIndex >= state.players.length) {
      state.currentPlayerIndex = 0;
    }
  }

  // Advance turn
  const steps = skipNext ? 2 : 1;
  state.currentPlayerIndex = nextIndex(state, pIndex, steps);

  // If next has pending draw, they need to take it (auto optional — we require draw action)
  state.lastAction = {
    type: "play",
    playerId,
    card: publicCard(card),
    color: state.currentColor,
    message: `${player.name} played a card`,
  };

  return { ok: true };
}

export function drawCards(state, playerId) {
  if (state.status !== "playing") return { ok: false, error: "Game not active" };
  const pIndex = state.players.findIndex((p) => p.id === playerId);
  if (pIndex !== state.currentPlayerIndex) return { ok: false, error: "Not your turn" };

  const player = state.players[pIndex];
  const amount = state.pendingDraw > 0 ? state.pendingDraw : 1;

  if (state.pendingDraw === 0 && state.turnDrawTaken) {
    return { ok: false, error: "Already drew — pass or play" };
  }

  const drawn = drawFromDeck(state, amount);
  player.hand.push(...drawn);
  player.saidOne = false;
  if (state.mustCallOne === playerId) state.mustCallOne = null;

  const wasPenalty = state.pendingDraw > 0;
  state.pendingDraw = 0;

  if (wasPenalty) {
    // After taking penalty, turn ends
    state.turnDrawTaken = false;
    state.currentPlayerIndex = nextIndex(state, pIndex, 1);
    state.lastAction = {
      type: "draw",
      playerId,
      count: drawn.length,
      message: `${player.name} drew ${drawn.length} card(s)`,
    };
    return { ok: true, drawnCount: drawn.length, endTurn: true };
  }

  // Normal draw: can play the drawn card if legal, or pass
  state.turnDrawTaken = true;
  const top = state.discard[state.discard.length - 1];
  const last = drawn[drawn.length - 1];
  const canPlayDrawn = last ? canPlay(last, top, state.currentColor) : false;

  state.lastAction = {
    type: "draw",
    playerId,
    count: drawn.length,
    message: `${player.name} drew a card`,
  };

  return { ok: true, drawnCount: drawn.length, endTurn: false, canPlayDrawn, drawnId: last?.id };
}

export function passTurn(state, playerId) {
  if (state.status !== "playing") return { ok: false, error: "Game not active" };
  const pIndex = state.players.findIndex((p) => p.id === playerId);
  if (pIndex !== state.currentPlayerIndex) return { ok: false, error: "Not your turn" };
  if (!state.turnDrawTaken) return { ok: false, error: "Draw first if you cannot play" };
  if (state.pendingDraw > 0) return { ok: false, error: "Must draw pending cards" };

  state.turnDrawTaken = false;
  state.currentPlayerIndex = nextIndex(state, pIndex, 1);
  const player = state.players[pIndex];
  state.lastAction = {
    type: "pass",
    playerId,
    message: `${player.name} passed`,
  };
  return { ok: true };
}

export function callOne(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, error: "Player not found" };
  if (player.hand.length !== 1) return { ok: false, error: "You need exactly one card" };
  player.saidOne = true;
  if (state.mustCallOne === playerId) state.mustCallOne = null;
  state.lastAction = {
    type: "callOne",
    playerId,
    message: `${player.name} called ONE!`,
  };
  return { ok: true };
}

export function catchOne(state, catcherId, targetId) {
  if (catcherId === targetId) return { ok: false, error: "Cannot catch yourself" };
  const target = state.players.find((p) => p.id === targetId);
  const catcher = state.players.find((p) => p.id === catcherId);
  if (!target || !catcher) return { ok: false, error: "Player not found" };
  if (target.hand.length !== 1) return { ok: false, error: "Target does not have one card" };
  if (target.saidOne) return { ok: false, error: "Already called ONE" };

  const penalty = drawFromDeck(state, 2);
  target.hand.push(...penalty);
  target.saidOne = false;
  if (state.mustCallOne === targetId) state.mustCallOne = null;

  state.lastAction = {
    type: "catch",
    playerId: catcherId,
    targetId,
    message: `${catcher.name} caught ${target.name}! +2 cards`,
  };
  return { ok: true };
}

/** Safe view for a specific player */
export function serializeFor(state, viewerId, roomMeta = {}) {
  const top = state.discard[state.discard.length - 1] || null;
  return {
    ...roomMeta,
    status: state.status,
    currentColor: state.currentColor,
    currentPlayerId: state.players[state.currentPlayerIndex]?.id ?? null,
    direction: state.direction,
    pendingDraw: state.pendingDraw,
    winnerId: state.winnerId,
    ranking: state.ranking,
    lastAction: state.lastAction,
    topCard: top,
    discardCount: state.discard.length,
    deckCount: state.deck.length,
    turnDrawTaken: state.players[state.currentPlayerIndex]?.id === viewerId ? state.turnDrawTaken : false,
    you: (() => {
      const me = state.players.find((p) => p.id === viewerId);
      if (!me) return null;
      return {
        id: me.id,
        name: me.name,
        hand: me.hand,
        saidOne: me.saidOne,
        isTurn: state.players[state.currentPlayerIndex]?.id === viewerId,
      };
    })(),
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      saidOne: p.saidOne && p.hand.length === 1,
      eliminated: p.eliminated,
      isTurn: state.players[state.currentPlayerIndex]?.id === p.id,
      isYou: p.id === viewerId,
    })),
  };
}
