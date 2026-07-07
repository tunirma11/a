/**
 * Premium procedural sounds via Web Audio API — no imported audio files.
 * Soft envelopes, warm tones, gentle filtering.
 */

let audioCtx = null;
let masterGain = null;
let enabled = true;
let unlocked = false;

const MASTER_VOLUME = 0.32;

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

export async function loadSoundPreference() {
  try {
    const { getPreference } = await import("./store.js");
    const stored = await getPreference("soundEnabled");
    if (stored !== null) enabled = stored;
  } catch {
    /* keep default */
  }
}

export async function saveSoundPreference(value) {
  enabled = Boolean(value);
  try {
    const { setPreference } = await import("./store.js");
    await setPreference("soundEnabled", enabled);
  } catch {
    /* ignore */
  }
}

function createContext() {
  if (audioCtx) return audioCtx;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  audioCtx = new Ctx();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = MASTER_VOLUME;

  const dry = audioCtx.createGain();
  dry.gain.value = 1;
  masterGain.connect(dry);
  dry.connect(audioCtx.destination);

  const wetSend = audioCtx.createGain();
  wetSend.gain.value = 0.14;
  const convolver = createImpulseReverb(audioCtx);
  masterGain.connect(wetSend);
  wetSend.connect(convolver);
  convolver.connect(audioCtx.destination);

  return audioCtx;
}

function createImpulseReverb(ctx) {
  const convolver = ctx.createConvolver();
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 0.45);
  const impulse = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2) * 0.22;
    }
  }

  convolver.buffer = impulse;
  return convolver;
}

export function bindSoundUnlock() {
  const unlock = () => {
    if (unlocked) return;
    const ctx = createContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    unlocked = true;
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
  };

  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock, { passive: true });
}

function now() {
  return audioCtx.currentTime;
}

function playTone({
  frequency,
  type = "sine",
  duration = 0.35,
  volume = 0.5,
  attack = 0.018,
  decay = 0.32,
  detune = 0,
  filterFreq = 2800,
  filterEnd = 900,
  startTime = null,
}) {
  if (!enabled || !audioCtx || !masterGain) return;

  const t0 = startTime ?? now();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  osc.detune.setValueAtTime(detune, t0);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(filterFreq, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 80), t0 + duration);
  filter.Q.value = 0.6;

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function playChord(notes, options = {}) {
  const { stagger = 0.07, ...rest } = options;
  const t0 = now();
  notes.forEach((freq, i) => {
    playTone({
      ...rest,
      frequency: freq,
      volume: (rest.volume ?? 0.4) * (1 - i * 0.08),
      startTime: t0 + i * stagger,
    });
  });
}

/** মেসেজ পাঠানো — হালকা উর্ধ্বমুখী স্বর */
export function playSend() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const t0 = now();
  playTone({
    frequency: 520,
    volume: 0.28,
    duration: 0.22,
    attack: 0.012,
    decay: 0.18,
    filterFreq: 3200,
    startTime: t0,
  });
  playTone({
    frequency: 780,
    type: "triangle",
    volume: 0.16,
    duration: 0.28,
    attack: 0.02,
    decay: 0.22,
    filterFreq: 2600,
    startTime: t0 + 0.04,
  });
}

/** নতুন মেসেজ পাওয়া — ক্রিস্টাল বেল টোন */
export function playReceive() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  playTone({
    frequency: 880,
    volume: 0.34,
    duration: 0.55,
    attack: 0.008,
    decay: 0.48,
    filterFreq: 4200,
    filterEnd: 1200,
  });
  playTone({
    frequency: 1175,
    type: "sine",
    volume: 0.22,
    duration: 0.5,
    attack: 0.01,
    decay: 0.42,
    detune: 4,
    filterFreq: 3800,
    startTime: now() + 0.09,
  });
}

/** লগইন সফল — উষ্ণ আরপেজিও */
export function playLogin() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  playChord([261.63, 329.63, 392.0, 523.25], {
    volume: 0.3,
    duration: 0.5,
    attack: 0.02,
    decay: 0.42,
    stagger: 0.09,
    filterFreq: 3000,
  });
}

/** লগআউট — নরম নিম্নস্বর */
export function playLogout() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const t0 = now();
  playTone({
    frequency: 392,
    volume: 0.22,
    duration: 0.4,
    attack: 0.015,
    decay: 0.35,
    filterFreq: 2200,
    startTime: t0,
  });
  playTone({
    frequency: 261.63,
    volume: 0.18,
    duration: 0.45,
    attack: 0.02,
    decay: 0.38,
    filterFreq: 1600,
    startTime: t0 + 0.1,
  });
}

/** এরর — মৃদু, বিভ্রান্তিকর নয় */
export function playError() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  playTone({
    frequency: 220,
    type: "triangle",
    volume: 0.2,
    duration: 0.28,
    attack: 0.01,
    decay: 0.22,
    filterFreq: 800,
    filterEnd: 400,
  });
}

/** অনলাইন ফিরে এলে — তাজা স্পার্কল */
export function playOnline() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  playChord([659.25, 783.99, 987.77], {
    volume: 0.24,
    duration: 0.38,
    attack: 0.01,
    decay: 0.3,
    stagger: 0.06,
    filterFreq: 4500,
  });
}

/** অফলাইন — খুব নরম সতর্কতা */
export function playOffline() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  playTone({
    frequency: 330,
    type: "triangle",
    volume: 0.14,
    duration: 0.35,
    attack: 0.025,
    decay: 0.3,
    filterFreq: 1400,
    filterEnd: 600,
  });
}

/** ইউজার সিলেক্ট / UI ট্যাপ */
export function playTap() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  playTone({
    frequency: 1046,
    volume: 0.1,
    duration: 0.08,
    attack: 0.005,
    decay: 0.06,
    filterFreq: 5000,
    filterEnd: 2000,
  });
}

/** সিঙ্ক সম্পন্ন */
export function playSync() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  playTone({
    frequency: 523.25,
    volume: 0.2,
    duration: 0.3,
    attack: 0.012,
    decay: 0.25,
    filterFreq: 3000,
  });
  playTone({
    frequency: 659.25,
    volume: 0.15,
    duration: 0.28,
    attack: 0.015,
    decay: 0.22,
    startTime: now() + 0.07,
    filterFreq: 2800,
  });
}

/** মেসেজ সফলভাবে পাঠানো (অফলাইন থেকে সিঙ্ক) */
export function playSentConfirm() {
  if (!createContext() || !enabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  playTone({
    frequency: 698.46,
    volume: 0.18,
    duration: 0.25,
    attack: 0.01,
    decay: 0.2,
    filterFreq: 3500,
  });
}
