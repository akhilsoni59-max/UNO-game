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

export class RoomManager {
  constructor() {
    /** @type {Map<string, any>} */
    this.rooms = new Map();
  }

  createRoom(hostSocketId, hostName) {
    let code = codeGen();
    while (this.rooms.has(code)) code = codeGen();

    const room = {
      code,
      hostId: hostSocketId,
      players: [
        {
          id: hostSocketId,
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

  joinRoom(code, socketId, name) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.game && room.game.status === "playing") {
      // allow reconnect by name? simple: reject if full and new
      const existing = room.players.find((p) => p.id === socketId);
      if (existing) {
        existing.connected = true;
        return { ok: true, room, reconnected: true };
      }
      return { ok: false, error: "Game already in progress" };
    }
    if (room.players.some((p) => p.id === socketId)) {
      return { ok: true, room, reconnected: true };
    }
    if (room.players.length >= MAX_PLAYERS) {
      return { ok: false, error: `Room full (max ${MAX_PLAYERS})` };
    }
    room.players.push({
      id: socketId,
      name: sanitizeName(name) || `Player ${room.players.length + 1}`,
      connected: true,
    });
    return { ok: true, room };
  }

  leaveRoom(socketId) {
    for (const [code, room] of this.rooms) {
      const idx = room.players.findIndex((p) => p.id === socketId);
      if (idx === -1) continue;

      if (room.game && room.game.status === "playing") {
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
    if (room.players.length < MIN_PLAYERS) {
      return { ok: false, error: "Need at least one player in the room" };
    }
    if (room.game?.status === "playing") return { ok: false, error: "Already playing" };

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
    return room.players.map((p) => ({
      socketId: p.id,
      state: serializeFor(room.game, p.id, {
        code: room.code,
        hostId: room.hostId,
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
    return { ok: true, room };
  }
}

function sanitizeName(name) {
  return String(name || "")
    .trim()
    .slice(0, 16)
    .replace(/[<>]/g, "");
}
