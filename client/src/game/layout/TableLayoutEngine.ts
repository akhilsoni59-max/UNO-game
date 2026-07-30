import { gameTokens } from "../tokens/gameTokens";

export type SeatRole = "local" | "leftLower" | "leftUpper" | "top" | "rightUpper" | "rightLower";

export interface Point {
  x: number;
  y: number;
}

export interface SeatLayout {
  role: SeatRole;
  /** Center of seat in stage pixels */
  anchor: Point;
  /** Hand fan rotation degrees (0 = horizontal, cards face center) */
  handRotation: number;
  /** Fan direction: 1 = open toward table center from seat */
  fanFacing: "up" | "down" | "inward";
  /** Compact opponent scale vs local */
  cardScale: number;
  /** Max cards shown as backs */
  maxVisibleCards: number;
  nameSide: "above" | "below" | "left" | "right";
}

export interface TableLayout {
  stageW: number;
  stageH: number;
  scale: number;
  center: Point;
  tableRx: number;
  tableRy: number;
  deck: Point;
  discard: Point;
  direction: Point;
  colorIndicator: Point;
  seats: SeatLayout[];
  localHand: {
    center: Point;
    fanWidth: number;
    baseScale: number;
    cardW: number;
    cardH: number;
  };
  hudPad: { top: number; bottom: number; side: number };
}

/** Conceptual normalized anchors (0–1) — refined by aspect & safe areas */
const SEAT_ANCHORS: Record<SeatRole, { nx: number; ny: number; rot: number; facing: SeatLayout["fanFacing"]; nameSide: SeatLayout["nameSide"] }> = {
  local: { nx: 0.5, ny: 0.91, rot: 0, facing: "up", nameSide: "above" },
  leftLower: { nx: 0.11, ny: 0.68, rot: 82, facing: "inward", nameSide: "right" },
  leftUpper: { nx: 0.15, ny: 0.24, rot: 95, facing: "inward", nameSide: "right" },
  top: { nx: 0.5, ny: 0.09, rot: 180, facing: "down", nameSide: "below" },
  rightUpper: { nx: 0.85, ny: 0.24, rot: -95, facing: "inward", nameSide: "left" },
  rightLower: { nx: 0.89, ny: 0.68, rot: -82, facing: "inward", nameSide: "left" },
};

const ROLE_ORDER_FOR_N: Record<number, SeatRole[]> = {
  1: ["local"],
  2: ["local", "top"],
  3: ["local", "leftUpper", "rightUpper"],
  4: ["local", "leftLower", "top", "rightLower"],
  5: ["local", "leftLower", "leftUpper", "rightUpper", "rightLower"],
  6: ["local", "leftLower", "leftUpper", "top", "rightUpper", "rightLower"],
};

/**
 * Map absolute player list (you first for local seat) into visual seats.
 * `players` should be ordered with local player at index 0, then clockwise.
 */
export function assignSeats(playerCount: number): SeatRole[] {
  const n = Math.min(6, Math.max(1, playerCount));
  return ROLE_ORDER_FOR_N[n] ?? ROLE_ORDER_FOR_N[6];
}

/**
 * Rotate opponents so local is bottom; others go clockwise by table order.
 * `orderedIds` = players in server order; `localId` = viewer.
 */
export function seatPlayersClockwise<T extends { id: string }>(
  players: T[],
  localId: string | null | undefined
): { player: T; role: SeatRole }[] {
  if (!players.length) return [];
  const localIdx = Math.max(
    0,
    players.findIndex((p) => p.id === localId)
  );
  const rotated = [...players.slice(localIdx), ...players.slice(0, localIdx)];
  const roles = assignSeats(rotated.length);
  return rotated.map((player, i) => ({ player, role: roles[i] }));
}

export function computeTableLayout(
  viewportW: number,
  viewportH: number,
  opts?: { playerCount?: number }
): TableLayout {
  const playerCount = opts?.playerCount ?? 6;

  // Logical stage: fixed aspect ~ 16:10 game board, letterboxed into viewport
  const logicalW = 1600;
  const logicalH = 1000;
  const pad = 8;
  const availW = Math.max(320, viewportW - pad * 2);
  const availH = Math.max(400, viewportH - pad * 2);

  let scale = Math.min(availW / logicalW, availH / logicalH);
  scale = Math.min(1.15, Math.max(0.48, scale));

  const stageW = logicalW * scale;
  const stageH = logicalH * scale;

  const center = { x: stageW / 2, y: stageH * 0.46 };
  const tableRx = stageW * 0.38;
  const tableRy = stageH * 0.32;

  const deck = { x: center.x - 78 * scale, y: center.y };
  const discard = { x: center.x + 78 * scale, y: center.y };
  const direction = { x: center.x, y: center.y - 88 * scale };
  const colorIndicator = { x: center.x, y: center.y + 92 * scale };

  // Local card scale
  let cardScale = scale;
  const localCardW = gameTokens.cardW * cardScale;
  if (localCardW < gameTokens.minLocalCardW) {
    cardScale = gameTokens.minLocalCardW / gameTokens.cardW;
  }
  if (localCardW > 130) {
    cardScale = 130 / gameTokens.cardW;
  }

  const narrow = viewportW < 900;
  const opponentScale = narrow ? 0.32 : 0.38;

  const roles = assignSeats(playerCount);
  const seats: SeatLayout[] = roles.map((role) => {
    const a = SEAT_ANCHORS[role];
    // Slight inset on very short heights
    let ny = a.ny;
    if (viewportH < 700 && role === "local") ny = 0.93;
    if (viewportH < 700 && role === "top") ny = 0.07;

    return {
      role,
      anchor: { x: a.nx * stageW, y: ny * stageH },
      handRotation: a.rot,
      fanFacing: a.facing,
      cardScale: role === "local" ? cardScale : opponentScale * scale * (1 / scale),
      maxVisibleCards: role === "local" ? 20 : narrow ? 4 : 6,
      nameSide: a.nameSide,
    };
  });

  const fanWidth = Math.min(stageW * 0.72, 720 * scale);

  return {
    stageW,
    stageH,
    scale,
    center,
    tableRx,
    tableRy,
    deck,
    discard,
    direction,
    colorIndicator,
    seats,
    localHand: {
      center: seats.find((s) => s.role === "local")!.anchor,
      fanWidth,
      baseScale: cardScale,
      cardW: gameTokens.cardW * cardScale,
      cardH: gameTokens.cardH * cardScale,
    },
    hudPad: { top: 48 * scale, bottom: 12, side: 12 },
  };
}

/** Fan layout for n cards along a seat */
export function computeFanSlots(
  n: number,
  opts: {
    center: Point;
    fanWidth: number;
    cardW: number;
    cardH: number;
    rotationDeg?: number;
    curveDepth?: number;
    maxAngle?: number;
    compact?: boolean;
  }
) {
  const {
    center,
    fanWidth,
    cardW,
    rotationDeg = 0,
    curveDepth = opts.compact ? 6 : 18,
    maxAngle = opts.compact ? 8 : 14,
  } = opts;

  if (n <= 0) return [] as { x: number; y: number; rotation: number; z: number }[];

  // Overlap intensifies with count
  let width = fanWidth;
  if (n <= 5) width = Math.min(fanWidth, n * cardW * 0.85);
  else if (n <= 10) width = Math.min(fanWidth, n * cardW * 0.55);
  else if (n <= 18) width = Math.min(fanWidth, n * cardW * 0.4);
  else width = fanWidth;

  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const localX = t * width;
    const localY = curveDepth * t * t * 4;
    const rot = t * maxAngle;
    // Rotate local fan into seat orientation
    const x = center.x + localX * cos - localY * sin;
    const y = center.y + localX * sin + localY * cos;
    return { x, y, rotation: rotationDeg + rot, z: i };
  });
}

export function getSeatByRole(layout: TableLayout, role: SeatRole): SeatLayout | undefined {
  return layout.seats.find((s) => s.role === role);
}
