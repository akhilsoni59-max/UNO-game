import { useEffect, useRef } from "react";
import type { Color } from "../../types";
import { sound } from "../sound/SoundManager";

const COLORS: Color[] = ["red", "yellow", "green", "blue"];

export function ColorSelector({
  open,
  onPick,
  onCancel,
}: {
  open: boolean;
  onPick: (c: Color) => void;
  onCancel: () => void;
}) {
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="gc-modal-backdrop gc-color-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="color-title"
    >
      <div className="gc-color-modal">
        <div className="gc-color-kicker">WILD CARD</div>
        <h2 id="color-title">Choose the arena color</h2>
        <div className="gc-color-wheel" aria-label="Available colors">
          <span className="gc-color-wheel-core" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          {COLORS.map((color, index) => (
            <button
              key={color}
              ref={index === 0 ? firstButton : undefined}
              type="button"
              className={`gc-color-btn color-${color}`}
              onClick={() => {
                sound.play("color");
                onPick(color);
              }}
              aria-label={`Choose ${color}`}
            >
              <span className="swatch" />
              <span className="label">{color.toUpperCase()}</span>
            </button>
          ))}
        </div>
        <button type="button" className="gc-color-cancel" onClick={onCancel}>
          Keep card
        </button>
      </div>
    </div>
  );
}
