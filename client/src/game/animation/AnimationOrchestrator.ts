import { easeOutBack, easeOutCubic, quadraticBezier } from "../tokens/animationTokens";

export type Vec2 = { x: number; y: number };

export interface FlyCardSpec {
  id: string;
  from: Vec2;
  to: Vec2;
  control?: Vec2;
  duration: number;
  startRotation?: number;
  endRotation?: number;
  startScale?: number;
  endScale?: number;
  faceDown?: boolean;
  flipAt?: number; // 0–1 progress when face becomes visible
  onFlip?: () => void;
  onUpdate?: (state: FlyFrame) => void;
  onComplete?: () => void;
}

export interface FlyFrame {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  faceDown: boolean;
  progress: number;
}

type QueueItem = {
  eventId: string;
  run: () => Promise<void>;
};

/**
 * Central animation queue — awaitable, deduped by eventId.
 * Animation state is independent of rule state.
 */
export class AnimationOrchestrator {
  private queue: QueueItem[] = [];
  private running = false;
  private seen = new Map<string, number>();
  private seenOrder: string[] = [];
  private maxSeen = 200;
  private locked = false;
  private listeners = new Set<() => void>();
  activeTweens = 0;
  flyingCount = 0;

  get isBusy() {
    return this.running || this.queue.length > 0 || this.locked;
  }

  get queued() {
    return this.queue.length;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  /** Skip cosmetic replay after reconnect */
  hasSeen(eventId: string) {
    return this.seen.has(eventId);
  }

  markSeen(eventId: string) {
    if (this.seen.has(eventId)) return;
    this.seen.set(eventId, Date.now());
    this.seenOrder.push(eventId);
    while (this.seenOrder.length > this.maxSeen) {
      const old = this.seenOrder.shift();
      if (old) this.seen.delete(old);
    }
  }

  setInputLock(v: boolean) {
    this.locked = v;
    this.emit();
  }

  async enqueue(eventId: string, run: () => Promise<void>) {
    if (this.seen.has(eventId)) return;
    this.markSeen(eventId);
    return new Promise<void>((resolve, reject) => {
      this.queue.push({
        eventId,
        run: async () => {
          try {
            await run();
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      });
      this.emit();
      void this.pump();
    });
  }

  /** Run immediately without queue (hover etc.) */
  async runDetached(run: () => Promise<void>) {
    this.activeTweens += 1;
    this.emit();
    try {
      await run();
    } finally {
      this.activeTweens -= 1;
      this.emit();
    }
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    this.emit();
    while (this.queue.length) {
      const item = this.queue.shift()!;
      this.activeTweens += 1;
      this.emit();
      try {
        await item.run();
      } catch (e) {
        console.warn("[anim]", item.eventId, e);
      }
      this.activeTweens -= 1;
      this.emit();
    }
    this.running = false;
    this.emit();
  }

  /**
   * rAF tween 0→1 with easing.
   */
  tween(
    duration: number,
    onFrame: (t: number) => void,
    easing: (t: number) => number = easeOutCubic
  ): Promise<void> {
    if (duration <= 0) {
      onFrame(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        const raw = Math.min(1, (now - start) / duration);
        onFrame(easing(raw));
        if (raw < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  flyCard(spec: FlyCardSpec): Promise<void> {
    this.flyingCount += 1;
    this.emit();

    const p0 = spec.from;
    const p2 = spec.to;
    const p1 =
      spec.control ??
      ({
        x: (p0.x + p2.x) / 2,
        y: Math.min(p0.y, p2.y) - Math.abs(p2.x - p0.x) * 0.18 - 40,
      } as Vec2);

    let flipped = false;
    const startRot = spec.startRotation ?? 0;
    const endRot = spec.endRotation ?? 0;
    const startScale = spec.startScale ?? 1;
    const endScale = spec.endScale ?? 1;
    let faceDown = spec.faceDown !== false;

    return this.tween(spec.duration, (t) => {
      const pos = quadraticBezier(t, p0, p1, p2);
      const rotation = startRot + (endRot - startRot) * t;
      // slight scale breathe mid-flight
      const mid = Math.sin(t * Math.PI) * 0.06;
      const scale = startScale + (endScale - startScale) * t + mid;

      if (spec.flipAt != null && !flipped && t >= spec.flipAt) {
        flipped = true;
        faceDown = false;
        spec.onFlip?.();
      }

      const frame: FlyFrame = {
        x: pos.x,
        y: pos.y,
        rotation,
        scale,
        faceDown: spec.faceDown === false ? false : faceDown,
        progress: t,
      };
      spec.onUpdate?.(frame);
    }, easeOutCubic).then(() => {
      // landing ease
      return this.tween(90, (t) => {
        const s = endScale * (1 + (1 - easeOutBack(t, 0.6)) * 0.04);
        spec.onUpdate?.({
          x: p2.x,
          y: p2.y,
          rotation: endRot,
          scale: s,
          faceDown: spec.faceDown === false ? false : faceDown,
          progress: 1,
        });
      }).then(() => {
        this.flyingCount -= 1;
        this.emit();
        spec.onComplete?.();
      });
    });
  }

  wait(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }
}

/** Singleton for the active table session */
export const tableAnim = new AnimationOrchestrator();
