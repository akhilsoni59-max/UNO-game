import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function ParticleLayer({
  burst,
}: {
  burst: { x: number; y: number; color: string; n?: number } | null;
}) {
  const [parts, setParts] = useState<Particle[]>([]);

  useEffect(() => {
    if (!burst) return;
    const n = burst.n ?? 14;
    const created: Particle[] = Array.from({ length: n }, (_, i) => {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = 1.2 + Math.random() * 2.5;
      return {
        id: Date.now() + i,
        x: burst.x,
        y: burst.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        color: burst.color,
      };
    });
    setParts(created);
    let raf = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setParts((prev) => {
        const next = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.04,
            life: p.life - 0.025,
          }))
          .filter((p) => p.life > 0);
        if (next.length) raf = requestAnimationFrame(tick);
        return next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [burst]);

  return (
    <div className="gc-particles" aria-hidden>
      {parts.map((p) => (
        <span
          key={p.id}
          style={{
            left: p.x,
            top: p.y,
            opacity: p.life,
            background: p.color,
            transform: `translate(-50%,-50%) scale(${0.5 + p.life})`,
          }}
        />
      ))}
    </div>
  );
}
