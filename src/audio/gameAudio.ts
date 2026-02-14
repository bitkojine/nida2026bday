import type { Judgement } from '../core/types';

interface HoldTone {
  oscillators: OscillatorNode[];
  gain: GainNode;
}

interface AudioDebugState {
  guideNotesRequested: number;
  guideNotesPlayed: number;
  backingNotesRequested: number;
  backingNotesPlayed: number;
}

function laneFrequency(lane: number): number {
  return [164.81, 196.0, 220.0, 246.94][Math.max(0, Math.min(3, lane))] ?? 164.81;
}

function createDistortionCurve(amount: number): Float32Array {
  const samples = 256;
  const curve = new Float32Array(samples);
  const k = Math.max(1, amount);
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function toWaveShaperCurve(input: Float32Array): Float32Array<ArrayBuffer> {
  return input as unknown as Float32Array<ArrayBuffer>;
}

export class GameAudio {
  constructor(private readonly muted = false) {}

  private context: AudioContext | null = null;

  private master: GainNode | null = null;

  private unlocked = false;

  private readonly holds = new Map<number, HoldTone>();

  private readonly debugState: AudioDebugState = {
    guideNotesRequested: 0,
    guideNotesPlayed: 0,
    backingNotesRequested: 0,
    backingNotesPlayed: 0,
  };

  private readonly distortionCurve = createDistortionCurve(60);

  private readonly outputBoost = 1;

  private getContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }

    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return null;
    }

    try {
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.context.destination);
      return this.context;
    } catch {
      this.context = null;
      this.master = null;
      return null;
    }
  }

  unlock(): void {
    if (this.muted) {
      this.unlocked = true;
      return;
    }

    const ctx = this.getContext();
    if (!ctx) {
      return;
    }
    void ctx.resume();
    this.unlocked = ctx.state === 'running';
  }

  isUnlocked(): boolean {
    if (this.muted) {
      return true;
    }

    const ctx = this.getContext();
    if (!ctx) {
      return false;
    }

    this.unlocked = ctx.state === 'running';
    return this.unlocked;
  }

  private noteInstrument(
    frequency: number,
    durationSec: number,
    volume: number,
    whenOffsetSec = 0,
  ): void {
    if (this.muted) {
      return;
    }

    const ctx = this.getContext();
    if (!ctx || !this.master || !this.unlocked) {
      return;
    }

    const now = ctx.currentTime + whenOffsetSec;
    const osc = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    const lowpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency * 1.01, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, frequency * 0.985), now + 0.024);
    shaper.curve = toWaveShaperCurve(this.distortionCurve);
    shaper.oversample = '2x';
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1900, now);
    lowpass.frequency.exponentialRampToValueAtTime(1200, now + durationSec * 0.95);
    lowpass.Q.setValueAtTime(0.8, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, Math.min(1, volume * this.outputBoost)),
      now + 0.006,
    );
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, Math.min(1, volume * this.outputBoost * 0.7)),
      now + durationSec * 0.38,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(shaper);
    shaper.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  onPress(lane: number): void {
    const laneHz = laneFrequency(lane);
    this.noteInstrument(laneHz * 2, 0.06, 0.12);
  }

  playSongGuideNote(frequency: number, holdDurationSec: number): void {
    this.debugState.guideNotesRequested += 1;
    const duration = Math.min(0.26, 0.08 + holdDurationSec * 0.24);
    this.noteInstrument(frequency * 1.5, duration, 0.08);
    if (this.unlocked || this.muted) {
      this.debugState.guideNotesPlayed += 1;
    }
  }

  playSongBacking(frequency: number, holdDurationSec: number): void {
    this.debugState.backingNotesRequested += 1;
    if (this.muted) {
      this.debugState.backingNotesPlayed += 1;
      return;
    }

    if (!this.unlocked) {
      return;
    }

    const root = Math.max(82, frequency * 0.5);
    const fifth = root * 1.5;
    const duration = Math.min(1.0, Math.max(0.48, 0.44 + holdDurationSec * 0.54));
    // Use the same instrument family for backing notes too.
    this.noteInstrument(root, duration, 0.08);
    this.noteInstrument(fifth, Math.max(0.36, duration - 0.06), 0.06, 0.02);
    this.debugState.backingNotesPlayed += 1;
  }

  startHold(lane: number): void {
    if (this.muted) {
      return;
    }

    if (this.holds.has(lane)) {
      return;
    }

    const ctx = this.getContext();
    if (!ctx || !this.master || !this.unlocked) {
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    const lowpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const baseHz = laneFrequency(lane) * 1.5;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseHz, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, baseHz * 0.99), now + 0.04);
    shaper.curve = toWaveShaperCurve(this.distortionCurve);
    shaper.oversample = '2x';
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1500, now);
    lowpass.frequency.exponentialRampToValueAtTime(980, now + 0.45);
    lowpass.Q.setValueAtTime(0.8, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.3);

    osc.connect(shaper);
    shaper.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.master);
    osc.start(now);

    this.holds.set(lane, { oscillators: [osc], gain });
  }

  stopHold(lane: number): void {
    const tone = this.holds.get(lane);
    if (!tone || !this.context) {
      return;
    }

    const now = this.context.currentTime;
    tone.gain.gain.cancelScheduledValues(now);
    tone.gain.gain.setValueAtTime(Math.max(0.0001, tone.gain.gain.value), now);
    tone.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    for (const oscillator of tone.oscillators) {
      oscillator.stop(now + 0.05);
    }
    this.holds.delete(lane);
  }

  stopAllHolds(): void {
    for (const lane of this.holds.keys()) {
      this.stopHold(lane);
    }
  }

  onJudgement(
    judgement: Judgement,
    options: { hypeStart: boolean; streakMilestone: boolean; lane: number | null },
  ): void {
    void judgement;
    void options;
  }

  readDebugState(): AudioDebugState {
    return {
      guideNotesRequested: this.debugState.guideNotesRequested,
      guideNotesPlayed: this.debugState.guideNotesPlayed,
      backingNotesRequested: this.debugState.backingNotesRequested,
      backingNotesPlayed: this.debugState.backingNotesPlayed,
    };
  }

  resetDebugState(): void {
    this.debugState.guideNotesRequested = 0;
    this.debugState.guideNotesPlayed = 0;
    this.debugState.backingNotesRequested = 0;
    this.debugState.backingNotesPlayed = 0;
  }

  suspend(): void {
    if (this.muted) {
      this.unlocked = false;
      return;
    }

    if (!this.context) {
      return;
    }
    this.stopAllHolds();
    void this.context.suspend();
    this.unlocked = false;
  }

  shutdown(): void {
    if (this.muted) {
      this.unlocked = false;
      return;
    }

    if (!this.context) {
      return;
    }
    this.stopAllHolds();
    this.master?.disconnect();
    void this.context.close();
    this.context = null;
    this.master = null;
    this.unlocked = false;
  }
}
