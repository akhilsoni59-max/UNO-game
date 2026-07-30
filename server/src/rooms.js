import { customAlphabet } from "nanoid";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  startGame,
  playCard,
  drawCards,
  passTurn,
  callOne,
  catchOne,
  serializeFor,
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

  const game = room.game;
  if (!game) return;

  const gp = game.players.find((p) => p.id === oldId);
  if (gp) gp.id = newId;
  if (game.mustCallOne === oldId) game.mustCallOne = newId;
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

    room.game = startGame(room.players.map((p) => ({ id: p.id, name: p.name })));
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
            isHost: pl.id === room.hostId,
            isYou: pl.id === p.id,
          })),
          maxPlayers: MAX_PLAYERS,
          minPlayers: MIN_PLAYERS,
        },
      }));
    }
    const connectedMap = new Map(room.players.map((pl) => [pl.id, pl.connected]));
    return room.players.map((p) => ({
      socketId: p.id,
      state: serializeFor(room.game, p.id, {
        code: room.code,
        hostId: room.hostId,
        connectedMap,
      }),
    }));
  }

  play(code, socketId, cardId, color) {
    const room = this.get(code);
    if (!room?.game) return { ok: false, error: "No active game" };
    return playCard(room.game, socketId, cardId, color);
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
}

function sanitizeName(name) {
  return String(name || "")
    .trim()
    .slice(0, 16)
    .replace(/[<>]/g, "");
}
