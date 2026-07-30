import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { RoomManager } from "./rooms.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { persistence } from "./persistence.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const ALLOWED_ORIGINS = new Set(
  CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
);
const ALLOW_VERCEL_PREVIEWS = process.env.ALLOW_VERCEL_PREVIEWS === "true";

function allowOrigin(origin, callback) {
  if (
    !origin ||
    ALLOWED_ORIGINS.has(origin) ||
    (ALLOW_VERCEL_PREVIEWS && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin))
  ) {
    callback(null, true);
    return;
  }
  callback(new Error("Origin is not allowed"));
}

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: allowOrigin }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  })
);
app.get("/health", (_req, res) =>
  res.json({ ok: true, database: persistence.status, uptime: Math.round(process.uptime()) })
);

// Serve built client in production
const clientDist = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/socket.io")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowOrigin, methods: ["GET", "POST"] },
});

const rooms = new RoomManager();
const oneCallTimers = new Map();
const turnTimers = new Map();
const botTimers = new Map();

function oneTimerKey(code, playerId) {
  return `${code}:${playerId}`;
}

function clearOneTimer(code, playerId) {
  const key = oneTimerKey(code, playerId);
  const timer = oneCallTimers.get(key);
  if (timer) clearTimeout(timer);
  oneCallTimers.delete(key);
}

function scheduleOnePenalty(room, playerId) {
  const deadline = room?.game?.oneCallDeadlines?.[playerId];
  if (!deadline) return;
  clearOneTimer(room.code, playerId);
  const key = oneTimerKey(room.code, playerId);
  const enforce = () => {
    const liveDeadline = rooms.get(room.code)?.game?.oneCallDeadlines?.[playerId];
    if (!liveDeadline) {
      oneCallTimers.delete(key);
      return;
    }
    const remaining = liveDeadline - Date.now();
    if (remaining > 0) {
      oneCallTimers.set(key, setTimeout(enforce, remaining));
      return;
    }
    oneCallTimers.delete(key);
    const result = rooms.applyMissedOnePenalty(room.code, playerId);
    if (!result.ok) return;
    const currentRoom = rooms.get(room.code);
    publishRoom(currentRoom, true);
  };
  const timer = setTimeout(enforce, Math.max(0, deadline - Date.now()));
  oneCallTimers.set(key, timer);
}

function emitRoom(room) {
  if (!room) return;
  for (const view of rooms.views(room)) {
    io.to(view.socketId).emit("state", view.state);
  }
}

function clearRoomTimer(map, code) {
  const timer = map.get(code);
  if (timer) clearTimeout(timer);
  map.delete(code);
}

function scheduleTurn(room) {
  if (!room?.game || room.game.status !== "playing") {
    if (room?.code) clearRoomTimer(turnTimers, room.code);
    return;
  }
  clearRoomTimer(turnTimers, room.code);
  const expectedPlayerId = room.game.players[room.game.currentPlayerIndex]?.id;
  const expectedDeadline = room.game.turnDeadline;
  const enforce = () => {
    const liveRoom = rooms.get(room.code);
    const game = liveRoom?.game;
    if (!liveRoom || !game || game.status !== "playing") return;
    const currentId = game.players[game.currentPlayerIndex]?.id;
    if (currentId !== expectedPlayerId || game.turnDeadline !== expectedDeadline) return;
    const result =
      game.turnDrawTaken && game.pendingDraw === 0
        ? rooms.pass(room.code, currentId)
        : rooms.draw(room.code, currentId);
    if (!result.ok) return;
    if (!result.endTurn && game.players[game.currentPlayerIndex]?.id === currentId) {
      rooms.pass(room.code, currentId);
    }
    publishRoom(liveRoom, true);
  };
  turnTimers.set(
    room.code,
    setTimeout(enforce, Math.max(0, expectedDeadline - Date.now()))
  );
}

function scheduleBot(room) {
  if (!room?.game || room.game.status !== "playing") {
    if (room?.code) clearRoomTimer(botTimers, room.code);
    return;
  }
  clearRoomTimer(botTimers, room.code);
  const currentId = room.game.players[room.game.currentPlayerIndex]?.id;
  const isBot = room.players.some((player) => player.id === currentId && player.isBot);
  if (!isBot) return;
  botTimers.set(
    room.code,
    setTimeout(() => {
      const liveRoom = rooms.get(room.code);
      if (!liveRoom?.game || liveRoom.game.status !== "playing") return;
      const liveId = liveRoom.game.players[liveRoom.game.currentPlayerIndex]?.id;
      if (liveId !== currentId) return;
      const result = rooms.runBotTurn(room.code, currentId);
      if (!result.ok) return;
      publishRoom(liveRoom, true);
      const botGamePlayer = liveRoom.game?.players.find((player) => player.id === currentId);
      if (botGamePlayer?.hand.length === 1 && liveRoom.game?.oneCallDeadlines?.[currentId]) {
        scheduleOnePenalty(liveRoom, currentId);
        setTimeout(() => {
          const callResult = rooms.callOne(room.code, currentId);
          if (!callResult.ok) return;
          clearOneTimer(room.code, currentId);
          publishRoom(rooms.get(room.code), true);
        }, 520);
      }
    }, 700)
  );
}

function publishRoom(room, sendEffect = false) {
  if (!room) return;
  emitRoom(room);
  if (sendEffect && room.game?.lastAction) {
    io.to(room.code).emit("effect", room.game.lastAction);
  }
  scheduleTurn(room);
  scheduleBot(room);
  persistence.syncRoom(room);
}

io.on("connection", (socket) => {
  let joinedCode = null;

  socket.on("create_room", ({ name, token }, cb) => {
    try {
      const room = rooms.createRoom(socket.id, name, token);
      joinedCode = room.code;
      socket.join(room.code);
      emitRoom(room);
      cb?.({ ok: true, code: room.code });
    } catch (e) {
      cb?.({ ok: false, error: e.message || "Failed to create room" });
    }
  });

  socket.on("join_room", ({ code, name, token }, cb) => {
    try {
      const result = rooms.joinRoom(code, socket.id, name, token);
      if (!result.ok) {
        cb?.(result);
        return;
      }
      joinedCode = result.room.code;
      socket.join(result.room.code);
      publishRoom(result.room);
      cb?.({ ok: true, code: result.room.code, reconnected: !!result.reconnected });
    } catch (e) {
      cb?.({ ok: false, error: e.message || "Failed to join" });
    }
  });

  socket.on("leave_room", (cb) => {
    try {
      if (!joinedCode) {
        cb?.({ ok: true });
        return;
      }
      const code = joinedCode;
      socket.leave(code);
      const left = rooms.leaveRoom(socket.id, { hard: true });
      joinedCode = null;
      if (left?.room) publishRoom(left.room);
      if (left?.deleted) persistence.removeRoom(code).catch((error) => console.error("[persistence]", error.message));
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message || "Failed to leave" });
    }
  });

  socket.on("start_game", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.start(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    publishRoom(result.room);
    io.to(joinedCode).emit("game_started");
    cb?.({ ok: true });
  });

  socket.on("play_card", ({ cardId, color, targetId }, cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.play(joinedCode, socket.id, cardId, color, targetId);
    if (!result.ok) return cb?.(result);
    const room = rooms.get(joinedCode);
    scheduleOnePenalty(room, socket.id);
    publishRoom(room, true);
    cb?.({ ok: true });
  });

  socket.on("draw", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.draw(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    const room = rooms.get(joinedCode);
    publishRoom(room, true);
    cb?.(result);
  });

  socket.on("pass", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.pass(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    publishRoom(rooms.get(joinedCode), true);
    cb?.({ ok: true });
  });

  socket.on("call_one", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.callOne(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    clearOneTimer(joinedCode, socket.id);
    const room = rooms.get(joinedCode);
    publishRoom(room, true);
    cb?.({ ok: true });
  });

  socket.on("catch_one", ({ targetId }, cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.catchOne(joinedCode, socket.id, targetId);
    if (!result.ok) return cb?.(result);
    clearOneTimer(joinedCode, targetId);
    const room = rooms.get(joinedCode);
    publishRoom(room, true);
    cb?.({ ok: true });
  });

  socket.on("chat_message", ({ text }, cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.addChat(joinedCode, socket.id, text);
    if (!result.ok) return cb?.(result);
    publishRoom(result.room);
    cb?.({ ok: true });
  });

  socket.on("set_rules", ({ rules }, cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.setRules(joinedCode, socket.id, rules);
    if (!result.ok) return cb?.(result);
    publishRoom(result.room);
    cb?.({ ok: true });
  });

  socket.on("add_bot", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.addBot(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    publishRoom(result.room);
    cb?.({ ok: true, botId: result.botId });
  });

  socket.on("remove_player", ({ targetId }, cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.removePlayer(joinedCode, socket.id, targetId);
    if (!result.ok) return cb?.(result);
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.leave(joinedCode);
      targetSocket.emit("removed_from_room");
    }
    publishRoom(result.room);
    cb?.({ ok: true });
  });

  socket.on("rematch", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.rematch(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    if (result.deleted || !result.room) {
      persistence.removeRoom(joinedCode).catch((error) => console.error("[persistence]", error.message));
      joinedCode = null;
      cb?.({ ok: true, deleted: true });
      return;
    }
    publishRoom(result.room);
    cb?.({ ok: true });
  });

  socket.on("vote_rematch", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.voteRematch(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    publishRoom(result.room);
    cb?.({ ok: true, ready: result.ready });
  });

  socket.on("disconnect", () => {
    const left = rooms.leaveRoom(socket.id, { hard: false });
    if (left?.room) publishRoom(left.room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`ChromaCards server on http://localhost:${PORT}`);
  console.log(`Expect client at ${CLIENT_ORIGIN}`);
});
