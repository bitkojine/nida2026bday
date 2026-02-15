import type { Judgement } from '../core/types';

interface HoldTone {
  oscillators: OscillatorNode[];
  shaper: WaveShaperNode;
  lowpass: BiquadFilterNode;
  gain: GainNode;
}

interface AudioDebugState {
  guideNotesRequested: number;
  guideNotesPlayed: number;
  backingNotesRequested: number;
  backingNotesPlayed: number;
}

interface AudioRuntimeStats {
  activeTransientVoices: number;
  activeHoldVoices: number;
  unlocked: boolean;
  userMuted: boolean;
  outputMuted: boolean;
}

interface AudioVisualizerSnapshot {
  bars: number[];
  level: number;
  peak: number;
}

interface NavigatorAudioSession {
  type: 'auto' | 'ambient' | 'playback' | 'transient' | 'transient-solo';
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
  constructor(private readonly hardMuted = false) {}

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

  private activeTransientVoices = 0;

  private readonly maxTransientVoices = 36;

  private userMuted = false;

  private visualPulse = 0;

  private visualPhase = 0;

  private readonly visualHoldLanes = new Set<number>();

  private isOutputMuted(): boolean {
    return this.hardMuted || this.userMuted;
  }

  private pushVisualizerPulse(amount: number): void {
    this.visualPulse = Math.min(1.8, this.visualPulse + Math.max(0, amount));
  }

  private configureAudioSessionForPlayback(): void {
    if (this.isOutputMuted()) {
      return;
    }

    const nav = navigator as Navigator & {
      audioSession?: NavigatorAudioSession;
    };
    const session = nav.audioSession;
    if (!session) {
      return;
    }
    try {
      if (session.type !== 'playback') {
        session.type = 'playback';
      }
    } catch {
      // Ignore environments where audioSession is read-only or unavailable.
    }
  }

  private disconnectNodes(...nodes: Array<AudioNode | null | undefined>): void {
    for (const node of nodes) {
      if (!node) {
        continue;
      }
      try {
        node.disconnect();
      } catch {
        // Ignore double-disconnect and already-detached nodes.
      }
    }
  }

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
    if (this.isOutputMuted()) {
      this.unlocked = true;
      return;
    }

    this.configureAudioSessionForPlayback();
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }
    void ctx.resume();
    this.unlocked = ctx.state === 'running';
  }

  isUnlocked(): boolean {
    if (this.isOutputMuted()) {
      return true;
    }

    const ctx = this.getContext();
    if (!ctx) {
      return false;
    }

    this.unlocked = ctx.state === 'running';
    return this.unlocked;
  }

  private noteInstrument(frequency: number, durationSec: number, whenOffsetSec = 0): void {
    this.pushVisualizerPulse(Math.min(1.2, 0.24 + durationSec * 1.1));
    if (this.isOutputMuted()) {
      return;
    }

    const ctx = this.getContext();
    if (!ctx || !this.master || !this.unlocked) {
      return;
    }

    if (this.activeTransientVoices >= this.maxTransientVoices) {
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
    gain.gain.exponentialRampToValueAtTime(1, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(1, now + durationSec * 0.38);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(shaper);
    shaper.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.master);
    this.activeTransientVoices += 1;
    osc.onended = () => {
      this.activeTransientVoices = Math.max(0, this.activeTransientVoices - 1);
      this.disconnectNodes(osc, shaper, lowpass, gain);
    };
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  onPress(lane: number): void {
    const laneHz = laneFrequency(lane);
    this.noteInstrument(laneHz * 2, 0.06);
  }

  playSongGuideNote(frequency: number, holdDurationSec: number): void {
    this.debugState.guideNotesRequested += 1;
    const duration = Math.min(0.26, 0.08 + holdDurationSec * 0.24);
    this.noteInstrument(frequency * 1.5, duration);
    if (this.unlocked || this.isOutputMuted()) {
      this.debugState.guideNotesPlayed += 1;
    }
  }

  playSongBacking(frequency: number, holdDurationSec: number): void {
    this.debugState.backingNotesRequested += 1;
    if (this.isOutputMuted()) {
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
    this.noteInstrument(root, duration);
    this.noteInstrument(fifth, Math.max(0.36, duration - 0.06), 0.02);
    this.debugState.backingNotesPlayed += 1;
  }

  startHold(lane: number): void {
    if (this.visualHoldLanes.has(lane)) {
      return;
    }
    this.visualHoldLanes.add(lane);
    this.pushVisualizerPulse(0.32);
    if (this.isOutputMuted()) {
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
    gain.gain.exponentialRampToValueAtTime(1, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(1, now + 0.3);

    osc.connect(shaper);
    shaper.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.master);
    osc.start(now);

    this.holds.set(lane, { oscillators: [osc], shaper, lowpass, gain });
  }

  stopHold(lane: number): void {
    this.visualHoldLanes.delete(lane);
    const tone = this.holds.get(lane);
    if (!tone) {
      return;
    }
    this.holds.delete(lane);

    if (!this.context) {
      this.disconnectNodes(...tone.oscillators, tone.shaper, tone.lowpass, tone.gain);
      return;
    }

    const now = this.context.currentTime;
    tone.gain.gain.cancelScheduledValues(now);
    tone.gain.gain.setValueAtTime(Math.max(0.0001, tone.gain.gain.value), now);
    tone.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    for (const oscillator of tone.oscillators) {
      oscillator.onended = () => {
        this.disconnectNodes(oscillator, tone.shaper, tone.lowpass, tone.gain);
      };
      try {
        oscillator.stop(now + 0.05);
      } catch {
        this.disconnectNodes(oscillator, tone.shaper, tone.lowpass, tone.gain);
      }
    }
  }

  stopAllHolds(): void {
    this.visualHoldLanes.clear();
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

  setMuted(nextMuted: boolean): void {
    this.userMuted = nextMuted;
    if (!this.context || !this.master) {
      return;
    }
    if (nextMuted) {
      this.stopAllHolds();
      this.master.gain.setValueAtTime(0, this.context.currentTime);
      return;
    }
    if (!this.hardMuted) {
      this.master.gain.setValueAtTime(1, this.context.currentTime);
    }
  }

  isMuted(): boolean {
    return this.userMuted;
  }

  readDebugState(): AudioDebugState {
    return {
      guideNotesRequested: this.debugState.guideNotesRequested,
      guideNotesPlayed: this.debugState.guideNotesPlayed,
      backingNotesRequested: this.debugState.backingNotesRequested,
      backingNotesPlayed: this.debugState.backingNotesPlayed,
    };
  }

  readRuntimeStats(): AudioRuntimeStats {
    return {
      activeTransientVoices: this.activeTransientVoices,
      activeHoldVoices: Math.max(this.holds.size, this.visualHoldLanes.size),
      unlocked: this.unlocked,
      userMuted: this.userMuted,
      outputMuted: this.isOutputMuted(),
    };
  }

  sampleVisualizer(barCount = 48): AudioVisualizerSnapshot {
    const safeBars = Math.max(12, Math.min(96, Math.floor(barCount)));
    const holdEnergy = this.visualHoldLanes.size * 0.2;
    const transientEnergy = this.activeTransientVoices * 0.02;
    const baseLevel = Math.min(1, this.visualPulse + holdEnergy + transientEnergy);
    this.visualPulse *= 0.9;

    const bars = new Array<number>(safeBars);
    let peak = 0;
    for (let i = 0; i < safeBars; i += 1) {
      const harmonic =
        0.58 +
        0.22 * Math.sin(this.visualPhase + i * 0.41) +
        0.2 * Math.sin(this.visualPhase * 0.73 + i * 0.19);
      const value = Math.max(0, Math.min(1, baseLevel * Math.abs(harmonic)));
      bars[i] = value;
      peak = Math.max(peak, value);
    }
    this.visualPhase += 0.14 + baseLevel * 0.05;

    return {
      bars,
      level: baseLevel,
      peak,
    };
  }

  resetDebugState(): void {
    this.debugState.guideNotesRequested = 0;
    this.debugState.guideNotesPlayed = 0;
    this.debugState.backingNotesRequested = 0;
    this.debugState.backingNotesPlayed = 0;
  }

  suspend(): void {
    if (this.hardMuted) {
      this.unlocked = false;
      return;
    }

    if (!this.context) {
      return;
    }
    this.stopAllHolds();
    this.activeTransientVoices = 0;
    void this.context.suspend();
    this.unlocked = false;
  }

  shutdown(): void {
    if (this.hardMuted) {
      this.unlocked = false;
      return;
    }

    if (!this.context) {
      return;
    }
    this.stopAllHolds();
    this.activeTransientVoices = 0;
    this.master?.disconnect();
    void this.context.close();
    this.context = null;
    this.master = null;
    this.unlocked = false;
  }
}
