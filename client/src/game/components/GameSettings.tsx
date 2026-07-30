import { useState } from "react";
import { sound } from "../sound/SoundManager";

export type ArenaTheme = "ocean" | "midnight" | "ember";

export function GameSettings({
  open,
  theme,
  onTheme,
  onClose,
}: {
  open: boolean;
  theme: ArenaTheme;
  onTheme: (theme: ArenaTheme) => void;
  onClose: () => void;
}) {
  const [sfx, setSfx] = useState(() => sound.preferences.sfx);
  const [haptics, setHaptics] = useState(() => sound.preferences.haptics);
  if (!open) return null;
  const themes: Array<{ id: ArenaTheme; title: string; color: string }> = [
    { id: "ocean", title: "Arena blue", color: "#057ea6" },
    { id: "midnight", title: "Midnight", color: "#334c74" },
    { id: "ember", title: "Ember", color: "#a64b37" },
  ];

  return (
    <div className="gc-choice-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="gc-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>PLAYER PREFERENCES</small>
            <h2 id="settings-title">Table settings</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings">×</button>
        </header>
        <fieldset>
          <legend>Arena finish</legend>
          <div className="gc-theme-options">
            {themes.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className={theme === entry.id ? "is-active" : ""}
                aria-pressed={theme === entry.id}
                onClick={() => onTheme(entry.id)}
              >
                <i style={{ background: entry.color }} />
                <span>{entry.title}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Game feel</legend>
          <label className="gc-volume-control">
            <span>Sound effects <b>{Math.round(sfx * 100)}%</b></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sfx}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSfx(next);
                sound.setPrefs({ sfx: next });
                sound.play("lift");
              }}
            />
          </label>
          <button
            type="button"
            className={`gc-setting-toggle ${haptics ? "is-active" : ""}`}
            aria-pressed={haptics}
            onClick={() => {
              const next = !haptics;
              setHaptics(next);
              sound.setPrefs({ haptics: next });
              if (next) sound.haptic("tap");
            }}
          >
            <i />
            <span><strong>Haptic feedback</strong><small>Supported phones only</small></span>
          </button>
        </fieldset>
        <p>Reduced motion follows your operating-system preference.</p>
      </section>
    </div>
  );
}
