/**
 * Quick smoke test for game rules + room reconnect (no network).
 * Run: node src/smoke-test.js
 */
import {
  startGame,
  playCard,
  drawCards,
  canPlay,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from "./game.js";
import { RoomManager } from "./rooms.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- Rules basics ---
assert(MIN_PLAYERS === 2, "MIN_PLAYERS should be 2");
assert(MAX_PLAYERS === 6, "MAX_PLAYERS should be 6");

const g = startGame([
  { id: "s1", name: "A" },
  { id: "s2", name: "B" },
]);
assert(g.status === "playing", "game starts");
assert(g.players[0].hand.length === 7, "hand size 7");
assert(g.discard.length === 1, "one discard");

const top = g.discard[g.discard.length - 1];
const playable = g.players[0].hand.filter((c) => canPlay(c, top, g.currentColor));
if (playable.length) {
  const card = playable[0];
  const color = card.color === "black" ? "red" : undefined;
  const r = playCard(g, "s1", card.id, color);
  assert(r.ok, `play should work: ${r.error}`);
} else {
  const r = drawCards(g, "s1");
  assert(r.ok, `draw should work: ${r.error}`);
}

// --- Room reconnect by token ---
const rm = new RoomManager();
const room = rm.createRoom("sock-host", "Host", "token-host");
assert(room.code.length === 6, "room code");

let j = rm.joinRoom(room.code, "sock-p2", "P2", "token-p2");
assert(j.ok, "p2 joins lobby");

const started = rm.start(room.code, "sock-host");
assert(started.ok, `start: ${started.error}`);
assert(started.room.game.status === "playing", "playing");

// Host disconnects (soft)
rm.leaveRoom("sock-host", { hard: false });
const hostSeat = room.players.find((p) => p.token === "token-host");
assert(hostSeat && hostSeat.connected === false, "host soft offline");

// Host reconnects with new socket id
const re = rm.joinRoom(room.code, "sock-host-new", "Host", "token-host");
assert(re.ok && re.reconnected, `reconnect: ${re.error}`);
assert(re.room.players.some((p) => p.id === "sock-host-new" && p.connected), "new socket seated");
assert(re.room.game.players.some((p) => p.id === "sock-host-new"), "game id rebound");
assert(re.room.hostId === "sock-host-new", "host id rebound");

// New player blocked mid-game
const blocked = rm.joinRoom(room.code, "sock-x", "X", "token-x");
assert(!blocked.ok, "strangers blocked mid-game");

console.log("smoke-test: all passed");
