import { createClient } from "@supabase/supabase-js";

const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

function iso(value) {
  return new Date(value || Date.now()).toISOString();
}

function publicSnapshot(room) {
  const game = room.game;
  return {
    hostSeat: Math.max(0, room.players.findIndex((player) => player.id === room.hostId)),
    players: room.players.map((player, seat) => ({
      seat,
      name: player.name,
      connected: !!player.connected,
      isBot: !!player.isBot,
    })),
    game: game
      ? {
          status: game.status,
          currentPlayerIndex: game.currentPlayerIndex,
          currentColor: game.currentColor,
          direction: game.direction,
          pendingDraw: game.pendingDraw,
          deckCount: game.deck.length,
          discard: game.discard.at(-1) || null,
          actionCount: game.actionLog?.length || 0,
          turnDeadline: game.turnDeadline,
        }
      : null,
  };
}

function ensureOk(result, operation) {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.message}`);
  }
}

export class SupabasePersistence {
  constructor({ url = process.env.SUPABASE_URL, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY } = {}) {
    this.enabled = !!(url && serviceRoleKey);
    this.client = this.enabled
      ? createClient(url, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
    this.queues = new Map();
    this.lastError = null;
  }

  get status() {
    if (!this.enabled) return "disabled";
    return this.lastError ? "degraded" : "configured";
  }

  syncRoom(room) {
    if (!this.enabled || !room) return;
    const prior = this.queues.get(room.code) || Promise.resolve();
    const next = prior
      .catch(() => undefined)
      .then(() => this.persistRoom(room))
      .then(() => {
        this.lastError = null;
      })
      .catch((error) => {
        this.lastError = error;
        console.error("[persistence]", error.message);
      })
      .finally(() => {
        if (this.queues.get(room.code) === next) this.queues.delete(room.code);
      });
    this.queues.set(room.code, next);
  }

  async persistRoom(room) {
    const game = room.game;
    const status = game?.status || "lobby";
    const roomResult = await this.client.from("active_rooms").upsert(
      {
        room_code: room.code,
        status,
        player_count: room.players.length,
        rules: room.rules,
        snapshot: publicSnapshot(room),
        match_id: room.matchId || null,
        created_at: iso(room.createdAt),
        expires_at: iso(Date.now() + ROOM_TTL_MS),
      },
      { onConflict: "room_code" }
    );
    ensureOk(roomResult, "active room upsert");

    if (!game || !room.matchId) return;
    const winner = game.players.find((player) => player.id === game.winnerId);
    const matchResult = await this.client.from("matches").upsert(
      {
        id: room.matchId,
        room_code: room.code,
        status: game.status,
        rules: game.rules,
        player_count: game.players.length,
        winner_name: winner?.name || null,
        action_count: game.actionLog?.length || 0,
        started_at: iso(room.matchStartedAt || room.createdAt),
        finished_at: game.status === "finished" ? iso(game.finishedAt) : null,
      },
      { onConflict: "id" }
    );
    ensureOk(matchResult, "match upsert");

    const ranking = new Map((game.ranking || []).map((id, index) => [id, index + 1]));
    const playerRows = game.players.map((player, seat) => ({
      match_id: room.matchId,
      seat,
      display_name: player.name,
      is_bot: !!room.players.find((entry) => entry.id === player.id)?.isBot,
      final_rank: ranking.get(player.id) || null,
      cards_remaining: player.hand.length,
    }));
    const playersResult = await this.client
      .from("match_players")
      .upsert(playerRows, { onConflict: "match_id,seat" });
    ensureOk(playersResult, "match players upsert");
  }

  async removeRoom(code) {
    if (!this.enabled || !code) return;
    const result = await this.client.from("active_rooms").delete().eq("room_code", code);
    ensureOk(result, "active room delete");
  }
}

export const persistence = new SupabasePersistence();
