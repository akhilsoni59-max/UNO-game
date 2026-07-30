import { useMemo } from "react";
import type { Card, Color, GameState } from "../../types";

function isWild(card: Card) {
  return card.type === "wild" || card.type === "wild4";
}

export function canPlayCard(
  card: Card,
  top: Card | null,
  currentColor: Color,
  isTurn: boolean,
  pendingDraw: number
) {
  if (!isTurn || pendingDraw > 0) return false;
  if (!top) return true;
  if (isWild(card)) return true;
  if (card.color === currentColor) return true;
  if (card.type === "number" && top.type === "number" && card.value === top.value) return true;
  if (card.type !== "number" && card.type === top.type) return true;
  return false;
}

export function usePlayableCards(state: GameState) {
  return useMemo(() => {
    const set = new Set<string>();
    const you = state.you;
    if (!you) return set;
    for (const c of you.hand) {
      if (canPlayCard(c, state.topCard, state.currentColor, you.isTurn, state.pendingDraw)) {
        set.add(c.id);
      }
    }
    return set;
  }, [state.you, state.topCard, state.currentColor, state.pendingDraw]);
}
