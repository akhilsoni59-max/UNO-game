import { customAlphabet } from "nanoid";
import { randomUUID } from "crypto";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  startGame,
  playCard,
  drawCards,
  passTurn,
  callOne,
  catchOne,
  applyMissedOnePenalty,
  serializeFor,
  DEFAULT_RULES,
  normalizeRules,
  getPlayableCards,
} from "./game.js";

const codeGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

/**
 * Rebind a player's socket id after reconnect (token stays stable).
 * Game state keys players by socket id, so all references must update.
 */
function rebindPlayerId(room, oldId, newId) {
  if (!oldId || oldId === newId) return;

  const seat = room.players.find((p) => p.id === oldId);
  if (seat) seat.id = newId;
  if (room.hostId === oldId) room.hostId = newId;
  if (room.rematchVotes?.has(oldId)) {
    room.rematchVotes.delete(oldId);
    room.rematchVotes.add(newId);
  }

  const game = room.game;
  if (!game) return;

  const gp = game.players.find((p) => p.id === oldId);
  if (gp) gp.id = newId;
  if (game.mustCallOne === oldId) game.mustCallOne = newId;
  if (game.oneCallDeadlines?.[oldId]) {
    game.oneCallDeadlines[newId] = game.oneCallDeadlines[oldId];
    delete game.oneCallDeadlines[oldId];
  }
  if (game.winnerId === oldId) game.winnerId = newId;
  if (Array.isArray(game.ranking)) {
    game.ranking = game.ranking.map((id) => (id === oldId ? newId : id));
  }
  if (game.lastAction) {
    if (game.lastAction.playerId === oldId) game.lastAction.playerId = newId;
    if (game.lastAction.targetId === oldId) game.lastAction.targetId = newId;
  }
}

export class RoomManager {
  constructor() {
    /** @type {Map<string, any>} */
    this.rooms = new Map();
  }

  createRoom(hostSocketId, hostName, token) {
    let code = codeGen();
    while (this.rooms.has(code)) code = codeGen();

    const room = {
      code,
      hostId: hostSocketId,
      players: [
        {
          id: hostSocketId,
          token: token || null,
          name: sanitizeName(hostName) || "Host",
          connected: true,
        },
      ],
      game: null,
      chat: [],
      chatSeq: 0,
      rules: normalizeRules(DEFAULT_RULES),
      rematchVotes: new Set(),
      botSeq: 0,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(String(code || "").toUpperCase()) || null;
  }

  /**
   * Join lobby or rejoin mid-game via stable token.
   */
  joinRoom(code, socketId, name, token) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "Room not found" };

    // Same socket already seated
    const bySocket = room.players.find((p) => p.id === socketId);
    if (bySocket) {
      bySocket.connected = true;
      if (token) bySocket.token = token;
      if (name) bySocket.name = sanitizeName(name) || bySocket.name;
      return { ok: true, room, reconnected: true };
    }

    // Reconnect by token (refresh / new tab / network blip)
    if (token) {
      const byToken = room.players.find((p) => p.token && p.token === token);
      if (byToken) {
        const oldId = byToken.id;
        rebindPlayerId(room, oldId, socketId);
        byToken.connected = true;
        if (name) byToken.name = sanitizeName(name) || byToken.name;
        return { ok: true, room, reconnected: true };
      }
    }

    if (room.game && room.game.status === "playing") {
      return { ok: false, error: "Game already in progress" };
    }
    if (room.game && room.game.status === "finished") {
      // Allow join into finished room only if not full — treat as lobby seat
      // (rematch clears game; until then reject new players if full)
    }

    if (room.players.length >= MAX_PLAYERS) {
      return { ok: false, error: `Room full (max ${MAX_PLAYERS})` };
    }

    // Prevent duplicate display names in lobby (optional soft rule)
    const clean = sanitizeName(name) || `Player ${room.players.length + 1}`;

    room.players.push({
      id: socketId,
      token: token || null,
      name: clean,
      connected: true,
    });
    return { ok: true, room };
  }

  /**
   * @param {string} socketId
   * @param {{ hard?: boolean }} [opts] hard=true removes from lobby; during game always soft
   */
  leaveRoom(socketId, opts = {}) {
    const hard = !!opts.hard;

    for (const [code, room] of this.rooms) {
      const idx = room.players.findIndex((p) => p.id === socketId);
      if (idx === -1) continue;

      // Mid-game: always soft-leave so reconnect can resume seat
      if (room.game && (room.game.status === "playing" || room.game.status === "finished")) {
        room.players[idx].connected = false;
        return { code, room, soft: true };
      }

      // Lobby: soft disconnect unless hard leave requested
      if (!hard) {
        room.players[idx].connected = false;
        return { code, room, soft: true };
      }

      room.players.splice(idx, 1);
      if (room.players.length === 0) {
        this.rooms.delete(code);
        return { code, room: null, deleted: true };
      }
      if (room.hostId === socketId) {
        room.hostId = room.players[0].id;
      }
      return { code, room };
    }
    return null;
  }

  start(code, socketId) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.hostId !== socketId) return { ok: false, error: "Only host can start" };

    const seated = room.players.filter((p) => p.connected);
    if (seated.length < MIN_PLAYERS) {
      return {
        ok: false,
        error: `Need at least ${MIN_PLAYERS} connected players to start`,
      };
    }
    if (room.game?.status === "playing") return { ok: false, error: "Already playing" };

    // Only deal to currently connected players
    room.players = room.players.filter((p) => p.connected);
    if (!room.players.some((p) => p.id === room.hostId)) {
      room.hostId = room.players[0].id;
    }

    room.rematchVotes.clear();
    room.matchId = randomUUID();
    room.matchStartedAt = Date.now();
    room.game = startGame(
      room.players.map((p) => ({ id: p.id, name: p.name })),
      room.rules
    );
    return { ok: true, room };
  }

  views(room) {
    if (!room.game) {
      return room.players.map((p) => ({
        socketId: p.id,
        state: {
          status: "lobby",
          code: room.code,
          hostId: room.hostId,
          players: room.players.map((pl) => ({
            id: pl.id,
            name: pl.name,
            connected: pl.connected,
            isBot: !!pl.isBot,
            isHost: pl.id === room.hostId,
            isYou: pl.id === p.id,
          })),
          maxPlayers: MAX_PLAYERS,
          minPlayers: MIN_PLAYERS,
          rules: room.rules,
        },
      }));
    }
    const connectedMap = new Map(room.players.map((pl) => [pl.id, pl.connected]));
    const botIds = new Set(room.players.filter((pl) => pl.isBot).map((pl) => pl.id));
    return room.players.map((p) => ({
      socketId: p.id,
      state: serializeFor(room.game, p.id, {
        code: room.code,
        hostId: room.hostId,
        connectedMap,
        botIds,
        chat: room.chat,
        rematchVotes: [...room.rematchVotes],
      }),
    }));
  }

  play(code, socketId, cardId, color, targetId) {
    const room = this.get(code);
    if (!room?.game) return { ok: false, error: "No active game" };
    return playCard(room.game, socketId, cardId, color, targetId);
  }

  setRules(code, socketId, rules) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.hostId !== socketId) return { ok: false, error: "Only host can change rules" };
    if (room.game?.status === "playing") {
      return { ok: false, error: "Rules cannot change during a match" };
    }
    room.rules = normalizeRules(rules);
    return { ok: true, room };
  }

  addBot(code, socketId) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.hostId !== socketId) return { ok: false, error: "Only host can add bots" };
    if (room.game) return { ok: false, error: "Bots can only join in the lobby" };
    if (room.players.length >= MAX_PLAYERS) return { ok: false, error: "Room is full" };
    room.botSeq += 1;
    const id = `bot_${room.code}_${room.botSeq}`;
    room.players.push({
      id,
      token: null,
      name: `Arena Bot ${room.botSeq}`,
      connected: true,
      isBot: true,
    });
    return { ok: true, room, botId: id };
  }

  removePlayer(code, socketId, targetId) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.hostId !== socketId) return { ok: false, error: "Only host can remove players" };
    if (room.game) return { ok: false, error: "Players cannot be removed during a match" };
    if (targetId === socketId) return { ok: false, error: "Use Leave room instead" };
    const index = room.players.findIndex((player) => player.id === targetId);
    if (index < 0) return { ok: false, error: "Player not found" };
    room.players.splice(index, 1);
    return { ok: true, room };
  }

  draw(code, socketId) {
    const room = this.get(code);
    if (!room?.game) return { ok: false, error: "No active game" };
    return drawCards(room.game, socketId);
  }

  pass(code, socketId) {
    const room = this.get(code);
    if (!room?.game) return { ok: false, error: "No active game" };
    return passTurn(room.game, socketId);
  }

  callOne(code, socketId) {
    const room = this.get(code);
    if (!room?.game) return { ok: false, error: "No active game" };
    return callOne(room.game, socketId);
  }

  catchOne(code, socketId, targetId) {
    const room = this.get(code);
    if (!room?.game) return { ok: false, error: "No active game" };
    return catchOne(room.game, socketId, targetId);
  }

  applyMissedOnePenalty(code, playerId, now) {
    const room = this.get(code);
    if (!room?.game) return { ok: false, error: "No active game" };
    return applyMissedOnePenalty(room.game, playerId, now);
  }

  runBotTurn(code, botId) {
    const room = this.get(code);
    const game = room?.game;
    const bot = room?.players.find((player) => player.id === botId && player.isBot);
    if (!room || !game || !bot || game.status !== "playing") {
      return { ok: false, error: "Bot turn unavailable" };
    }
    if (game.players[game.currentPlayerIndex]?.id !== botId) {
      return { ok: false, error: "Not the bot's turn" };
    }
    const playable = getPlayableCards(game, botId);
    if (playable.length) {
      const card = playable[Math.floor(Math.random() * playable.length)];
      const colors = ["red", "yellow", "green", "blue"];
      const color = card.color === "black"
        ? colors[Math.floor(Math.random() * colors.length)]
        : undefined;
      const targetId =
        game.rules.sevenZero && card.type === "number" && card.value === 7
          ? game.players.find((player) => player.id !== botId && !player.eliminated)?.id
          : undefined;
      return playCard(game, botId, card.id, color, targetId);
    }
    if (!game.turnDrawTaken || game.pendingDraw > 0) {
      return drawCards(game, botId);
    }
    return passTurn(game, botId);
  }

  addChat(code, socketId, text) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "Room not found" };
    const player = room.players.find((entry) => entry.id === socketId);
    if (!player) return { ok: false, error: "Not in this room" };
    const clean = String(text || "").trim().slice(0, 180);
    if (!clean) return { ok: false, error: "Message is empty" };
    room.chatSeq += 1;
    const message = {
      id: `${room.code}-${room.chatSeq}`,
      playerId: socketId,
      name: player.name,
      text: clean,
      time: Date.now(),
    };
    room.chat.push(message);
    if (room.chat.length > 40) room.chat.splice(0, room.chat.length - 40);
    return { ok: true, room, message };
  }

  rematch(code, socketId) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.hostId !== socketId) return { ok: false, error: "Only host can rematch" };
    room.game = null;
    // Drop permanently disconnected seats so lobby is clean
    room.players = room.players.filter((p) => p.connected);
    if (room.players.length === 0) {
      this.rooms.delete(code);
      return { ok: true, room: null, deleted: true };
    }
    if (!room.players.some((p) => p.id === room.hostId)) {
      room.hostId = room.players[0].id;
    }
    return { ok: true, room };
  }

  voteRematch(code, socketId) {
    const room = this.get(code);
    if (!room?.game || room.game.status !== "finished") {
      return { ok: false, error: "Match is not finished" };
    }
    const voter = room.players.find((player) => player.id === socketId && !player.isBot);
    if (!voter) return { ok: false, error: "Player not found" };
    room.rematchVotes.add(socketId);
    const eligible = room.players.filter((player) => player.connected && !player.isBot);
    const ready = eligible.length > 0 && eligible.every((player) => room.rematchVotes.has(player.id));
    if (ready) {
      room.game = null;
      room.rematchVotes.clear();
    }
    return { ok: true, room, ready };
  }
}

function sanitizeName(name) {
  return String(name || "")
    .trim()
    .slice(0, 16)
    .replace(/[<>]/g, "");
}
