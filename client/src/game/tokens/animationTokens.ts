/** Motion timing tokens (ms) and easing curves. */

export const animationTokens = {
  // Draw
  drawAnticipation: 70,
  drawFlight: 400,
  drawFlip: 150,
  drawHandSettle: 220,
  drawStagger: 80,

  // Play
  playFlight: 340,
  playLift: 90,
  playLand: 120,

  // Flip
  flipTotal: 180,

  // Effects
  skipEffect: 450,
  reverseEffect: 520,
  wildExpand: 280,
  dealStagger: 55,
  dealFlight: 380,

  // Hover / micro
  hover: 140,
  errorShake: 320,
  turnPulse: 600,
  toast: 1800,

  // Easings (CSS / cubic-bezier)
  easeFlight: "cubic-bezier(0.22, 0.75, 0.18, 1)",
  easeLand: "cubic-bezier(0.34, 1.25, 0.64, 1)",
  easeHover: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeInOut: "cubic-bezier(0.45, 0, 0.55, 1)",

  // Reduced motion multipliers
  reducedScale: 0.35,
} as const;

/** Cubic Bézier point for card flight paths */
export function quadraticBezier(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutBack(t: number, overshoot = 0.85) {
  const c1 = 1.2 * overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
