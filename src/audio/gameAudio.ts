import type { Judgement } from '../core/types';

interface HoldTone {
  oscillator: OscillatorNode;
  gain: GainNode;
}

interface AudioDebugState {
  guideNotesRequested: number;
  guideNotesPlayed: number;
  backingNotesRequested: number;
  backingNotesPlayed: number;
}

function laneFrequency(lane: number): number {
  return [220, 262, 330, 392][Math.max(0, Math.min(3, lane))] ?? 220;
}

export class GameAudio {
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
      this.master.gain.value = 0.34;
      this.master.connect(this.context.destination);
      return this.context;
    } catch {
      this.context = null;
      this.master = null;
      return null;
    }
  }

  unlock(): void {
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }
    void ctx.resume();
    this.unlocked = ctx.state === 'running';
  }

  isUnlocked(): boolean {
    const ctx = this.getContext();
    if (!ctx) {
      return false;
    }

    this.unlocked = ctx.state === 'running';
    return this.unlocked;
  }

  private tone(
    frequency: number,
    durationSec: number,
    kind: OscillatorType,
    volume: number,
    whenOffsetSec = 0,
  ): void {
    const ctx = this.getContext();
    if (!ctx || !this.master || !this.unlocked) {
      return;
    }

    const now = ctx.currentTime + whenOffsetSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = kind;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  onPress(lane: number): void {
    this.tone(laneFrequency(lane), 0.045, 'triangle', 0.06);
  }

  playSongGuideNote(frequency: number, holdDurationSec: number): void {
    this.debugState.guideNotesRequested += 1;
    const duration = Math.min(0.28, 0.08 + holdDurationSec * 0.25);
    this.tone(frequency, duration, 'sine', 0.045);
    if (this.unlocked) {
      this.debugState.guideNotesPlayed += 1;
    }
  }

  playSongBacking(frequency: number, holdDurationSec: number): void {
    this.debugState.backingNotesRequested += 1;
    if (!this.unlocked) {
      return;
    }

    const root = Math.max(110, frequency * 0.5);
    const third = root * 1.25;
    const fifth = root * 1.5;
    const duration = Math.min(1.2, Math.max(0.55, 0.45 + holdDurationSec * 0.6));
    this.tone(root, duration, 'triangle', 0.048);
    this.tone(third, Math.max(0.45, duration - 0.04), 'sine', 0.032, 0.02);
    this.tone(fifth, Math.max(0.4, duration - 0.09), 'sine', 0.03, 0.04);
    this.debugState.backingNotesPlayed += 1;
  }

  startHold(lane: number): void {
    if (this.holds.has(lane)) {
      return;
    }

    const ctx = this.getContext();
    if (!ctx || !this.master || !this.unlocked) {
      return;
    }

    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(laneFrequency(lane) * 0.75, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.05);

    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);

    this.holds.set(lane, { oscillator, gain });
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
    tone.oscillator.stop(now + 0.05);
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
    if (judgement === 'TOBULA') {
      const base = laneFrequency(options.lane ?? 1) * 1.5;
      this.tone(base, 0.09, 'triangle', 0.11);
      this.tone(base * 1.25, 0.11, 'sine', 0.1, 0.015);
    } else if (judgement === 'GERAI') {
      this.tone(laneFrequency(options.lane ?? 1) * 1.1, 0.085, 'sine', 0.085);
    } else {
      this.tone(170, 0.08, 'sawtooth', 0.08);
      this.tone(120, 0.09, 'square', 0.05, 0.03);
    }

    if (options.streakMilestone) {
      this.tone(392, 0.09, 'triangle', 0.09);
      this.tone(494, 0.11, 'triangle', 0.09, 0.04);
      this.tone(587, 0.13, 'triangle', 0.09, 0.08);
    }

    if (options.hypeStart) {
      this.tone(262, 0.12, 'square', 0.085);
      this.tone(330, 0.12, 'square', 0.09, 0.06);
      this.tone(440, 0.14, 'triangle', 0.1, 0.12);
    }
  }

  readDebugState(): AudioDebugState {
    return {
      guideNotesPlayed: this.debugState.guideNotesPlayed,
      backingNotesPlayed: this.debugState.backingNotesPlayed,
    };
  }

  resetDebugState(): void {
    this.debugState.guideNotesRequested = 0;
    this.debugState.guideNotesPlayed = 0;
    this.debugState.backingNotesRequested = 0;
    this.debugState.backingNotesPlayed = 0;
  }
}
