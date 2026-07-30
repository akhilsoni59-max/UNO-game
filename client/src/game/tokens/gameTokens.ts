/**
 * ChromaCards design tokens — single source for visual identity.
 * Mirrored as CSS custom properties in table.css via :root.game-tokens
 */

export const gameTokens = {
  // Environment
  bgDeep: "#070b12",
  bgMid: "#0c1220",
  tableSurface: "#142033",
  tableSurfaceHi: "#1a2a42",
  tableRim: "#2a3d5c",
  tableRimGold: "rgba(196, 168, 110, 0.35)",
  vignette: "rgba(0, 0, 0, 0.55)",
  ambientGlow: "rgba(90, 140, 200, 0.08)",

  // Text
  textPrimary: "#eef2f7",
  textSecondary: "#8b9bb0",
  textMuted: "#5c6b80",
  textOnDark: "#0a0e14",

  // Four suit colors (restrained, not neon)
  colorRed: "#c93c3c",
  colorRedDeep: "#8f2424",
  colorYellow: "#d4a824",
  colorYellowDeep: "#9a7610",
  colorGreen: "#2f9e5f",
  colorGreenDeep: "#1d6b3f",
  colorBlue: "#2f6fbf",
  colorBlueDeep: "#1a4a8a",
  colorBlack: "#1a1f2a",

  // Interaction
  playableGlow: "rgba(232, 214, 160, 0.45)",
  playableEdge: "rgba(240, 220, 160, 0.75)",
  warning: "#e07070",
  success: "#4caf7a",
  focusRing: "rgba(140, 190, 255, 0.65)",
  turnHalo: "rgba(232, 200, 110, 0.55)",
  offline: "#6a7380",

  // Card chrome
  cardShadow: "0 12px 28px rgba(0, 0, 0, 0.45)",
  cardShadowLift: "0 18px 36px rgba(0, 0, 0, 0.55)",
  cardEdge: "rgba(0, 0, 0, 0.55)",
  cardInnerHi: "rgba(255, 255, 255, 0.22)",
  cardFaceWhite: "#f4f1ea",
  cardBackBase: "#121826",
  cardBackPattern: "#1c2740",
  cardBackEmblem: "#c4a86e",

  // Chrome UI
  modalBg: "rgba(10, 14, 22, 0.92)",
  panelBg: "rgba(14, 20, 32, 0.88)",
  panelBorder: "rgba(255, 255, 255, 0.08)",
  hudPillBg: "rgba(8, 12, 20, 0.72)",

  // Card geometry (logical px)
  cardW: 112,
  cardH: 160,
  cardRadiusRatio: 0.1,
  minLocalCardW: 72,
  opponentCardW: 42,
  opponentCardH: 60,
} as const;

export type GameColor = "red" | "yellow" | "green" | "blue";

export const suitColor: Record<GameColor | "black", { main: string; deep: string }> = {
  red: { main: gameTokens.colorRed, deep: gameTokens.colorRedDeep },
  yellow: { main: gameTokens.colorYellow, deep: gameTokens.colorYellowDeep },
  green: { main: gameTokens.colorGreen, deep: gameTokens.colorGreenDeep },
  blue: { main: gameTokens.colorBlue, deep: gameTokens.colorBlueDeep },
  black: { main: gameTokens.colorBlack, deep: "#0d1118" },
};

export function cssVarsFromTokens(): Record<string, string> {
  return {
    "--gc-bg-deep": gameTokens.bgDeep,
    "--gc-bg-mid": gameTokens.bgMid,
    "--gc-table": gameTokens.tableSurface,
    "--gc-table-hi": gameTokens.tableSurfaceHi,
    "--gc-table-rim": gameTokens.tableRim,
    "--gc-table-rim-gold": gameTokens.tableRimGold,
    "--gc-text": gameTokens.textPrimary,
    "--gc-text-2": gameTokens.textSecondary,
    "--gc-text-3": gameTokens.textMuted,
    "--gc-red": gameTokens.colorRed,
    "--gc-yellow": gameTokens.colorYellow,
    "--gc-green": gameTokens.colorGreen,
    "--gc-blue": gameTokens.colorBlue,
    "--gc-playable": gameTokens.playableGlow,
    "--gc-warning": gameTokens.warning,
    "--gc-success": gameTokens.success,
    "--gc-focus": gameTokens.focusRing,
    "--gc-turn": gameTokens.turnHalo,
    "--gc-modal": gameTokens.modalBg,
    "--gc-panel": gameTokens.panelBg,
    "--gc-panel-border": gameTokens.panelBorder,
    "--gc-card-w": `${gameTokens.cardW}px`,
    "--gc-card-h": `${gameTokens.cardH}px`,
  };
}
