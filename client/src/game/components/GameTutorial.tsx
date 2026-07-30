import { useState } from "react";

const STEPS = [
  {
    eyebrow: "01 · MATCH",
    title: "Follow the table color",
    copy: "Play a card matching the active color, number, or action symbol. Playable cards lift slightly from your hand.",
    focus: "cards",
  },
  {
    eyebrow: "02 · DRAW",
    title: "No match? Draw",
    copy: "Tap the draw pile or use the action control beneath it. After drawing, play that new card or pass.",
    focus: "deck",
  },
  {
    eyebrow: "03 · SPECIAL CARDS",
    title: "Control the round",
    copy: "Skip, Reverse, +2, Wild, and +4 each trigger a distinct table effect. The field manual shows the active house rules.",
    focus: "center",
  },
  {
    eyebrow: "04 · LAST CARD",
    title: "Call 1 in time",
    copy: "When one card remains, press the flashing 1 button within three seconds or take a two-card penalty.",
    focus: "one",
  },
] as const;

export function GameTutorial({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  function finish() {
    localStorage.setItem("cc_tutorial_seen", "1");
    onFinish();
  }

  return (
    <div className={`gc-tutorial focus-${current.focus}`} role="dialog" aria-modal="true">
      <section>
        <div className="gc-tutorial-progress" aria-label={`Tutorial step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((entry, index) => (
            <i key={entry.eyebrow} className={index <= step ? "is-complete" : ""} />
          ))}
        </div>
        <small>{current.eyebrow}</small>
        <h2>{current.title}</h2>
        <p>{current.copy}</p>
        <footer>
          <button type="button" className="gc-tutorial-skip" onClick={finish}>
            Skip tutorial
          </button>
          <button
            type="button"
            className="gc-tutorial-next"
            onClick={() => {
              if (step === STEPS.length - 1) finish();
              else setStep((value) => value + 1);
            }}
          >
            {step === STEPS.length - 1 ? "Start playing" : "Next"}
          </button>
        </footer>
      </section>
    </div>
  );
}
