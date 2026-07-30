/**
 * Quick smoke test for game rules + room reconnect (no network).
 * Run: node src/smoke-test.js
 */
import {
  startGame,
  playCard,
  drawCards,
  getPlayableCards,
  canPlayWild4,
  callOne,
  applyMissedOnePenalty,
  ONE_CALL_WINDOW_MS,
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

const active = g.players[g.currentPlayerIndex];
const playable = getPlayableCards(g, active.id);
if (g.pendingDraw > 0) {
  const r = drawCards(g, active.id);
  assert(r.ok, `pending draw should work: ${r.error}`);
} else if (playable.length) {
  const card = playable[0];
  const color = card.color === "black" ? "red" : undefined;
  const r = playCard(g, active.id, card.id, color);
  assert(r.ok, `play should work: ${r.error}`);
} else {
  const r = drawCards(g, active.id);
  assert(r.ok, `draw should work: ${r.error}`);
}

// --- Deterministic action-card flow ---
const penalty = startGame([
  { id: "p1", name: "Penalty A" },
  { id: "p2", name: "Penalty B" },
  { id: "p3", name: "Penalty C" },
]);
penalty.currentPlayerIndex = 0;
penalty.pendingDraw = 0;
penalty.direction = 1;
penalty.currentColor = "red";
penalty.discard = [{ id: "top-red", color: "red", type: "number", value: 5 }];
penalty.players[0].hand = [{ id: "draw-two", color: "red", type: "draw2" }];
let result = playCard(penalty, "p1", "draw-two");
assert(result.ok, `draw two should play: ${result.error}`);
assert(penalty.currentPlayerIndex === 1, "draw two targets the immediate next player");
assert(penalty.pendingDraw === 2, "draw two creates a two-card penalty");
result = drawCards(penalty, "p2");
assert(result.ok && result.endTurn, "penalty draw ends the penalized player's turn");
assert(penalty.currentPlayerIndex === 2, "turn advances after penalty is taken");

const wildFourHand = [
  { id: "wild-four", color: "black", type: "wild4" },
  { id: "matching-red", color: "red", type: "number", value: 2 },
];
assert(!canPlayWild4(wildFourHand, "wild-four", "red"), "wild +4 is blocked with a color match");
assert(canPlayWild4(wildFourHand, "wild-four", "blue"), "wild +4 is legal without a color match");

const afterDraw = startGame([
  { id: "d1", name: "Draw A" },
  { id: "d2", name: "Draw B" },
]);
afterDraw.currentPlayerIndex = 0;
afterDraw.pendingDraw = 0;
afterDraw.currentColor = "blue";
afterDraw.discard = [{ id: "top-blue", color: "blue", type: "number", value: 5 }];
afterDraw.players[0].hand = [
  { id: "old-blue", color: "blue", type: "number", value: 7 },
  { id: "drawn-blue", color: "blue", type: "number", value: 9 },
];
afterDraw.turnDrawTaken = true;
afterDraw.turnDrawnCardId = "drawn-blue";
result = playCard(afterDraw, "d1", "old-blue");
assert(!result.ok, "a pre-existing card cannot be played after drawing");
result = playCard(afterDraw, "d1", "drawn-blue");
assert(result.ok, "the newly drawn card can be played");

// --- Three-second 1 call ---
const oneCall = startGame([
  { id: "o1", name: "One A" },
  { id: "o2", name: "One B" },
]);
oneCall.currentPlayerIndex = 0;
oneCall.pendingDraw = 0;
oneCall.currentColor = "red";
oneCall.discard = [{ id: "one-top", color: "red", type: "number", value: 2 }];
oneCall.players[0].hand = [
  { id: "one-play", color: "red", type: "number", value: 6 },
  { id: "one-left", color: "yellow", type: "number", value: 4 },
];
const beforeOnePlay = Date.now();
result = playCard(oneCall, "o1", "one-play");
assert(result.ok, `one-card setup should play: ${result.error}`);
assert(oneCall.oneCallDeadlines.o1 >= beforeOnePlay + ONE_CALL_WINDOW_MS, "1 call gets a three-second window");
result = callOne(oneCall, "o1");
assert(result.ok, `1 call should succeed: ${result.error}`);
assert(!oneCall.oneCallDeadlines.o1 && oneCall.players[0].saidOne, "1 call cancels its penalty");

const missedOne = startGame([
  { id: "m1", name: "Missed A" },
  { id: "m2", name: "Missed B" },
]);
missedOne.players[0].hand = [{ id: "last-card", color: "blue", type: "number", value: 1 }];
missedOne.mustCallOne = "m1";
missedOne.oneCallDeadlines.m1 = Date.now() - 1;
const beforePenalty = missedOne.players[0].hand.length;
result = applyMissedOnePenalty(missedOne, "m1");
assert(result.ok, `missed 1 call should penalize: ${result.error}`);
assert(missedOne.players[0].hand.length === beforePenalty + 2, "missed 1 call draws two cards");
assert(!missedOne.oneCallDeadlines.m1, "penalty closes the 1 call window");

// --- Room reconnect by token ---
const rm = new RoomManager();
const room = rm.createRoom("sock-host", "Host", "token-host");
assert(room.code.length === 6, "room code");

let j = rm.joinRoom(room.code, "sock-p2", "P2", "token-p2");
assert(j.ok, "p2 joins lobby");

let chatResult = rm.addChat(room.code, "sock-host", "Good luck!");
assert(chatResult.ok, `chat should send: ${chatResult.error}`);
assert(room.chat.length === 1 && room.chat[0].text === "Good luck!", "room stores chat history");
chatResult = rm.addChat(room.code, "sock-p2", " ".repeat(8));
assert(!chatResult.ok, "empty chat messages are rejected");

const started = rm.start(room.code, "sock-host");
assert(started.ok, `start: ${started.error}`);
assert(started.room.game.status === "playing", "playing");
const hostView = rm.views(room).find((view) => view.socketId === "sock-host");
assert(hostView?.state.chat?.length === 1, "game view includes room chat");

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

// --- Configurable house rules ---
const stacked = startGame(
  [
    { id: "s1", name: "Stack A" },
    { id: "s2", name: "Stack B" },
  ],
  { stacking: true }
);
stacked.currentPlayerIndex = 0;
stacked.currentColor = "red";
stacked.pendingDraw = 2;
stacked.discard = [{ id: "stack-top", color: "blue", type: "draw2" }];
stacked.players[0].hand = [{ id: "stack-card", color: "red", type: "draw2" }];
result = playCard(stacked, "s1", "stack-card");
assert(result.ok, `matching penalty should stack: ${result.error}`);
assert(stacked.pendingDraw === 4, "stacked +2 accumulates to +4");

const jump = startGame(
  [
    { id: "j1", name: "Jump A" },
    { id: "j2", name: "Jump B" },
    { id: "j3", name: "Jump C" },
  ],
  { jumpIn: true }
);
jump.currentPlayerIndex = 0;
jump.currentColor = "green";
jump.pendingDraw = 0;
jump.discard = [{ id: "jump-top", color: "green", type: "number", value: 4 }];
jump.players[1].hand = [
  { id: "jump-card", color: "green", type: "number", value: 4 },
  { id: "jump-spare", color: "yellow", type: "number", value: 2 },
];
result = playCard(jump, "j2", "jump-card");
assert(result.ok, `identical out-of-turn card should jump in: ${result.error}`);
assert(jump.lastAction.jumpIn, "jump-in is recorded in action history");

const drawMatch = startGame(
  [
    { id: "u1", name: "Draw Match A" },
    { id: "u2", name: "Draw Match B" },
  ],
  { drawUntilPlayable: true }
);
drawMatch.currentPlayerIndex = 0;
drawMatch.currentColor = "red";
drawMatch.pendingDraw = 0;
drawMatch.discard = [{ id: "draw-match-top", color: "red", type: "number", value: 1 }];
drawMatch.deck = [
  { id: "draw-match-good", color: "red", type: "number", value: 8 },
  { id: "draw-match-bad", color: "blue", type: "number", value: 6 },
];
const beforeDrawMatch = drawMatch.players[0].hand.length;
result = drawCards(drawMatch, "u1");
assert(result.ok && result.drawnCount === 2, "draw-to-match continues until a playable card");
assert(drawMatch.players[0].hand.length === beforeDrawMatch + 2, "all draw-to-match cards enter hand");

const sevenSwap = startGame(
  [
    { id: "z1", name: "Seven A" },
    { id: "z2", name: "Seven B" },
  ],
  { sevenZero: true }
);
sevenSwap.currentPlayerIndex = 0;
sevenSwap.currentColor = "red";
sevenSwap.pendingDraw = 0;
sevenSwap.discard = [{ id: "seven-top", color: "red", type: "number", value: 3 }];
sevenSwap.players[0].hand = [
  { id: "seven-card", color: "red", type: "number", value: 7 },
  { id: "seven-spare", color: "yellow", type: "number", value: 2 },
];
sevenSwap.players[1].hand = [
  { id: "seven-target-a", color: "blue", type: "number", value: 5 },
  { id: "seven-target-b", color: "green", type: "number", value: 9 },
];
result = playCard(sevenSwap, "z1", "seven-card", undefined, "z2");
assert(result.ok, `seven should swap selected hands: ${result.error}`);
assert(sevenSwap.players[0].hand.some((card) => card.id === "seven-target-a"), "seven receives target hand");
assert(sevenSwap.players[1].hand.some((card) => card.id === "seven-spare"), "target receives played hand");

const roomRules = new RoomManager();
const customRoom = roomRules.createRoom("custom-host", "Custom Host", "custom-token");
result = roomRules.setRules(customRoom.code, "custom-host", {
  stacking: true,
  jumpIn: true,
});
assert(result.ok && customRoom.rules.stacking && customRoom.rules.jumpIn, "host updates house rules");
result = roomRules.addBot(customRoom.code, "custom-host");
assert(result.ok && customRoom.players.some((player) => player.isBot), "host adds a practice bot");
result = roomRules.start(customRoom.code, "custom-host");
assert(result.ok && customRoom.game.rules.stacking, "selected house rules reach the game");
customRoom.game.status = "finished";
result = roomRules.voteRematch(customRoom.code, "custom-host");
assert(result.ok && result.ready && customRoom.game === null, "human vote starts bot rematch lobby");

console.log("smoke-test: all passed");
