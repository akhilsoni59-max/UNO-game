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
  if (!open) return null;
  return (
    <div className="gc-modal-backdrop" role="dialog" aria-label="Choose color">
      <div className="gc-modal gc-color-modal">
        <h2>Choose color</h2>
        <p>Sets the active table color</p>
        <div className="gc-color-grid">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`gc-color-btn color-${c}`}
              onClick={() => {
                sound.play("color");
                onPick(c);
              }}
              aria-label={c}
            >
              <span className="swatch" />
              <span className="label">{c}</span>
            </button>
          ))}
        </div>
        <button type="button" className="gc-btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
