import { useMemo } from "react";
import type { Card, Color, GameState, RuleSettings } from "../../types";

function isWild(card: Card) {
  return card.type === "wild" || card.type === "wild4";
}

export function canPlayCard(
  card: Card,
  top: Card | null,
  currentColor: Color,
  isTurn: boolean,
  pendingDraw: number,
  rules: RuleSettings
) {
  if (!top) return true;
  if (!isTurn) {
    if (!rules.jumpIn || pendingDraw > 0) return false;
    return (
      card.color === top.color &&
      card.type === top.type &&
      (card.type !== "number" || card.value === top.value)
    );
  }
  if (pendingDraw > 0) {
    if (!rules.stacking) return false;
    return (
      (top.type === "draw2" && card.type === "draw2") ||
      (top.type === "wild4" && card.type === "wild4")
    );
  }
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
      if (state.turnDrawTaken && c.id !== state.drawnCardId) continue;
      if (
        c.type === "wild4" &&
        you.hand.some(
          (other) =>
            other.id !== c.id &&
            other.type !== "wild" &&
            other.type !== "wild4" &&
            other.color === state.currentColor
        )
      ) {
        continue;
      }
      if (
        canPlayCard(
          c,
          state.topCard,
          state.currentColor,
          you.isTurn,
          state.pendingDraw,
          state.rules
        )
      ) {
        set.add(c.id);
      }
    }
    return set;
  }, [
    state.you,
    state.topCard,
    state.currentColor,
    state.pendingDraw,
    state.turnDrawTaken,
    state.drawnCardId,
    state.rules,
  ]);
}
