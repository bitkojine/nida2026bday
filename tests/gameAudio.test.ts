import { describe, expect, test } from 'vitest';
import { GameAudio } from '../src/audio/gameAudio';

class FakeAudioParam {
  value = 0;
  peak = 0;

  setValueAtTime(value: number): void {
    this.value = value;
    this.peak = Math.max(this.peak, value);
  }

  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
    this.peak = Math.max(this.peak, value);
  }

  cancelScheduledValues(): void {}
}

class FakeAudioNode {
  disconnected = false;

  connect(): void {}

  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine';
  frequency = new FakeAudioParam();
  onended: (() => void) | null = null;

  start(): void {}

  stop(): void {}
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
}

class FakeWaveShaperNode extends FakeAudioNode {
  curve: Float32Array<ArrayBuffer> | null = null;
  oversample: OverSampleType = 'none';
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = new FakeAudioNode();
  oscillators: FakeOscillatorNode[] = [];
  gains: FakeGainNode[] = [];
  filters: FakeBiquadFilterNode[] = [];
  shapers: FakeWaveShaperNode[] = [];

  createGain(): FakeGainNode {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  createOscillator(): FakeOscillatorNode {
    const node = new FakeOscillatorNode();
    this.oscillators.push(node);
    return node;
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    const node = new FakeBiquadFilterNode();
    this.filters.push(node);
    return node;
  }

  createWaveShaper(): FakeWaveShaperNode {
    const node = new FakeWaveShaperNode();
    this.shapers.push(node);
    return node;
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }
}

describe('GameAudio', () => {
  test('sets audio session to playback when unlocking on supported browsers', () => {
    const ctx = new FakeAudioContext();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: class {
        constructor() {
          return ctx;
        }
      },
    });

    const audioSession = { type: 'ambient' as const };
    Object.defineProperty(navigator, 'audioSession', {
      configurable: true,
      value: audioSession,
    });

    const audio = new GameAudio(false);
    audio.unlock();

    expect(audioSession.type).toBe('playback');
  });

  test('limits transient voices to prevent runaway overlap', () => {
    const ctx = new FakeAudioContext();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: class {
        constructor() {
          return ctx;
        }
      },
    });

    const audio = new GameAudio(false);
    audio.unlock();

    for (let i = 0; i < 80; i += 1) {
      audio.onPress(i % 4);
    }

    expect(ctx.oscillators.length).toBeLessThanOrEqual(36);
  });

  test('disconnects hold chain nodes when hold is released', () => {
    const ctx = new FakeAudioContext();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: class {
        constructor() {
          return ctx;
        }
      },
    });

    const audio = new GameAudio(false);
    audio.unlock();

    const baseOscCount = ctx.oscillators.length;
    const baseGainCount = ctx.gains.length;
    const baseFilterCount = ctx.filters.length;
    const baseShaperCount = ctx.shapers.length;

    audio.startHold(0);
    audio.stopHold(0);

    const holdOsc = ctx.oscillators[baseOscCount];
    const holdGain = ctx.gains[baseGainCount];
    const holdFilter = ctx.filters[baseFilterCount];
    const holdShaper = ctx.shapers[baseShaperCount];
    holdOsc?.onended?.();

    expect(holdOsc?.disconnected).toBe(true);
    expect(holdGain?.disconnected).toBe(true);
    expect(holdFilter?.disconnected).toBe(true);
    expect(holdShaper?.disconnected).toBe(true);
  });

  test('drives transient and hold gains to full scale', () => {
    const ctx = new FakeAudioContext();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: class {
        constructor() {
          return ctx;
        }
      },
    });

    const audio = new GameAudio(false);
    audio.unlock();
    audio.onPress(0);
    audio.startHold(1);

    const masterGain = ctx.gains[0];
    const transientGain = ctx.gains[1];
    const holdGain = ctx.gains[2];
    expect(masterGain?.gain.value).toBe(1);
    expect(transientGain?.gain.peak).toBe(1);
    expect(holdGain?.gain.peak).toBe(1);
  });

  test('toggles user mute state and silences active holds immediately', () => {
    const ctx = new FakeAudioContext();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: class {
        constructor() {
          return ctx;
        }
      },
    });

    const audio = new GameAudio(false);
    audio.unlock();
    audio.startHold(2);

    const before = audio.readRuntimeStats();
    expect(before.userMuted).toBe(false);
    expect(before.outputMuted).toBe(false);
    expect(before.activeHoldVoices).toBe(1);

    audio.setMuted(true);
    const muted = audio.readRuntimeStats();
    expect(audio.isMuted()).toBe(true);
    expect(muted.userMuted).toBe(true);
    expect(muted.outputMuted).toBe(true);
    expect(muted.activeHoldVoices).toBe(0);
    expect(ctx.gains[0]?.gain.value).toBe(0);

    audio.setMuted(false);
    const unmuted = audio.readRuntimeStats();
    expect(audio.isMuted()).toBe(false);
    expect(unmuted.userMuted).toBe(false);
    expect(unmuted.outputMuted).toBe(false);
    expect(ctx.gains[0]?.gain.value).toBe(1);
  });

  test('visualizer reports activity for note events even when hard-muted', () => {
    const audio = new GameAudio(true);
    audio.unlock();
    audio.onPress(0);
    audio.playSongGuideNote(220, 0);
    audio.playSongBacking(220, 0);

    const snapshot = audio.sampleVisualizer(16);
    expect(snapshot.bars.length).toBe(16);
    expect(snapshot.peak).toBeGreaterThan(0);
    expect(snapshot.level).toBeGreaterThan(0);
  });

  test('visualizer keeps activity while hold is active even when user-muted', () => {
    const audio = new GameAudio(false);
    audio.unlock();
    audio.setMuted(true);
    audio.startHold(1);

    const active = audio.sampleVisualizer(16);
    expect(active.peak).toBeGreaterThan(0);
    expect(audio.readRuntimeStats().activeHoldVoices).toBe(1);

    audio.stopHold(1);
    const released = audio.sampleVisualizer(16);
    expect(audio.readRuntimeStats().activeHoldVoices).toBe(0);
    expect(released.peak).toBeGreaterThanOrEqual(0);
  });
});
