/**
 * ChromaCards design tokens — single source for visual identity.
 * Mirrored as CSS custom properties in table.css via :root.game-tokens
 */

export const gameTokens = {
  // Environment
  bgDeep: "#001827",
  bgMid: "#00395c",
  tableSurface: "#00699d",
  tableSurfaceHi: "#0089c3",
  tableRim: "#00527d",
  tableRimGold: "rgba(112, 218, 255, 0.28)",
  vignette: "rgba(0, 0, 0, 0.55)",
  ambientGlow: "rgba(90, 140, 200, 0.08)",

  // Text
  textPrimary: "#eef2f7",
  textSecondary: "#8b9bb0",
  textMuted: "#5c6b80",
  textOnDark: "#0a0e14",

  // Four suit colors (restrained, not neon)
  colorRed: "#ff1728",
  colorRedDeep: "#d60019",
  colorYellow: "#ffc515",
  colorYellowDeep: "#e69a00",
  colorGreen: "#2fd000",
  colorGreenDeep: "#159800",
  colorBlue: "#0798d8",
  colorBlueDeep: "#006caf",
  colorBlack: "#101114",

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
  cardBackBase: "#111215",
  cardBackPattern: "#1c1e22",
  cardBackEmblem: "#f4f5f6",

  // Chrome UI
  modalBg: "rgba(10, 14, 22, 0.92)",
  panelBg: "rgba(14, 20, 32, 0.88)",
  panelBorder: "rgba(255, 255, 255, 0.08)",
  hudPillBg: "rgba(8, 12, 20, 0.72)",

  // Card geometry (logical px)
  cardW: 104,
  cardH: 160,
  cardRadiusRatio: 0.1,
  minLocalCardW: 54,
  opponentCardW: 47,
  opponentCardH: 72,
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
