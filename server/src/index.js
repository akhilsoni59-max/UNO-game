import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { RoomManager } from "./rooms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: true }));
app.get("/health", (_req, res) => res.json({ ok: true }));

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
  cors: { origin: true, methods: ["GET", "POST"] },
});

const rooms = new RoomManager();

function emitRoom(room) {
  if (!room) return;
  for (const view of rooms.views(room)) {
    io.to(view.socketId).emit("state", view.state);
  }
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
      emitRoom(result.room);
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
      if (left?.room) emitRoom(left.room);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message || "Failed to leave" });
    }
  });

  socket.on("start_game", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.start(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    emitRoom(result.room);
    io.to(joinedCode).emit("game_started");
    cb?.({ ok: true });
  });

  socket.on("play_card", ({ cardId, color }, cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.play(joinedCode, socket.id, cardId, color);
    if (!result.ok) return cb?.(result);
    const room = rooms.get(joinedCode);
    emitRoom(room);
    io.to(joinedCode).emit("effect", room.game.lastAction);
    cb?.({ ok: true });
  });

  socket.on("draw", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.draw(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    const room = rooms.get(joinedCode);
    emitRoom(room);
    io.to(joinedCode).emit("effect", room.game.lastAction);
    cb?.(result);
  });

  socket.on("pass", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.pass(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    emitRoom(rooms.get(joinedCode));
    cb?.({ ok: true });
  });

  socket.on("call_one", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.callOne(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    const room = rooms.get(joinedCode);
    emitRoom(room);
    io.to(joinedCode).emit("effect", room.game.lastAction);
    cb?.({ ok: true });
  });

  socket.on("catch_one", ({ targetId }, cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.catchOne(joinedCode, socket.id, targetId);
    if (!result.ok) return cb?.(result);
    const room = rooms.get(joinedCode);
    emitRoom(room);
    io.to(joinedCode).emit("effect", room.game.lastAction);
    cb?.({ ok: true });
  });

  socket.on("rematch", (cb) => {
    if (!joinedCode) return cb?.({ ok: false, error: "Not in a room" });
    const result = rooms.rematch(joinedCode, socket.id);
    if (!result.ok) return cb?.(result);
    if (result.deleted || !result.room) {
      joinedCode = null;
      cb?.({ ok: true, deleted: true });
      return;
    }
    emitRoom(result.room);
    cb?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const left = rooms.leaveRoom(socket.id, { hard: false });
    if (left?.room) emitRoom(left.room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`ChromaCards server on http://localhost:${PORT}`);
  console.log(`Expect client at ${CLIENT_ORIGIN}`);
});
