/**
 * Original synthesized SFX via Web Audio API — no external audio assets.
 * Preferences persist in localStorage.
 */

type SfxName =
  | "lift"
  | "slide"
  | "land"
  | "draw"
  | "flip"
  | "play"
  | "invalid"
  | "turn"
  | "reverse"
  | "skip"
  | "penalty"
  | "color"
  | "win"
  | "deal";

const PREF_KEY = "cc_audio_prefs";

interface Prefs {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
  haptics: boolean;
}

const defaultPrefs: Prefs = {
  master: 0.7,
  sfx: 0.85,
  music: 0.4,
  muted: false,
  haptics: true,
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { ...defaultPrefs };
    return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    return { ...defaultPrefs };
  }
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private prefs: Prefs = loadPrefs();
  private unlocked = false;

  get preferences() {
    return { ...this.prefs };
  }

  setPrefs(partial: Partial<Prefs>) {
    this.prefs = { ...this.prefs, ...partial };
    localStorage.setItem(PREF_KEY, JSON.stringify(this.prefs));
  }

  haptic(kind: "tap" | "success" | "error" | "penalty" = "tap") {
    if (!this.prefs.haptics || typeof navigator === "undefined" || !navigator.vibrate) return;
    const pattern =
      kind === "success"
        ? [18, 35, 28]
        : kind === "error"
          ? [35, 28, 35]
          : kind === "penalty"
            ? [55, 35, 55]
            : 12;
    navigator.vibrate(pattern);
  }

  async unlock() {
    if (this.unlocked) return;
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    this.unlocked = true;
  }

  private ensure() {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private level() {
    if (this.prefs.muted) return 0;
    return this.prefs.master * this.prefs.sfx;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    gain = 0.08,
    slideTo?: number
  ) {
    const vol = this.level() * gain;
    if (vol <= 0.0001) return;
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), ctx.currentTime + dur);
    }
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, gain = 0.04) {
    const vol = this.level() * gain;
    if (vol <= 0.0001) return;
    const ctx = this.ensure();
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
  }

  play(name: SfxName, variation = 0) {
    void this.unlock();
    const v = variation * 0.04;
    switch (name) {
      case "lift":
        this.tone(420 + v * 100, 0.06, "triangle", 0.05);
        break;
      case "slide":
        this.noise(0.05, 0.025);
        this.tone(280, 0.08, "sine", 0.03, 180);
        break;
      case "land":
        this.noise(0.04, 0.03);
        this.tone(180 + v * 40, 0.07, "triangle", 0.06);
        break;
      case "draw":
        this.noise(0.06, 0.028);
        this.tone(320, 0.1, "sine", 0.04, 240);
        break;
      case "flip":
        this.tone(520, 0.05, "square", 0.025);
        this.tone(780, 0.08, "sine", 0.03);
        break;
      case "play":
        this.tone(360 + v * 50, 0.07, "triangle", 0.05);
        this.tone(540, 0.1, "sine", 0.04);
        break;
      case "invalid":
        this.haptic("error");
        this.tone(160, 0.12, "sawtooth", 0.04, 100);
        break;
      case "turn":
        this.tone(440, 0.08, "sine", 0.04);
        this.tone(660, 0.12, "sine", 0.035);
        break;
      case "reverse":
        this.tone(300, 0.15, "triangle", 0.045, 600);
        break;
      case "skip":
        this.tone(500, 0.05, "square", 0.03);
        this.tone(200, 0.1, "sine", 0.04);
        break;
      case "penalty":
        this.haptic("penalty");
        this.tone(140, 0.18, "sawtooth", 0.04, 90);
        break;
      case "color":
        this.tone(400, 0.08, "sine", 0.04);
        this.tone(600, 0.1, "sine", 0.035);
        break;
      case "win":
        this.haptic("success");
        [523, 659, 784, 1046].forEach((f, i) => {
          setTimeout(() => this.tone(f, 0.2, "triangle", 0.05), i * 90);
        });
        break;
      case "deal":
        this.noise(0.03, 0.02);
        this.tone(300 + Math.random() * 80, 0.05, "triangle", 0.03);
        break;
    }
  }
}

export const sound = new SoundManager();
