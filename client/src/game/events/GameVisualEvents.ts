import type { Card, Color } from "../../types";

export type GameVisualEvent =
  | { type: "DEAL_CARD"; playerId: string; card: Card; eventId: string }
  | { type: "DRAW_CARD"; playerId: string; card?: Card; count?: number; eventId: string }
  | { type: "PLAY_CARD"; playerId: string; card: Card; eventId: string }
  | { type: "TURN_CHANGED"; playerId: string; eventId: string }
  | { type: "COLOR_SELECTED"; color: Color; eventId: string }
  | { type: "PLAYER_SKIPPED"; playerId: string; eventId: string }
  | { type: "DIRECTION_CHANGED"; direction: 1 | -1; eventId: string }
  | { type: "PLAYER_WON"; playerId: string; eventId: string };

export function visualEventId(prefix: string) {
  return `visual-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
