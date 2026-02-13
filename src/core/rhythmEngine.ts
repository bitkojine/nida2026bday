import { calculateJudgement } from './timingCalculator';
import type { ChartStep } from './songMap';
import type { DanceRules, Judgement } from './types';

export type HitTiming = 'on-time' | 'early' | 'late' | 'none';

export interface HitEvaluation {
  judgement: Judgement;
  timing: HitTiming;
  noteType: 'tap' | 'hold';
  beatId: number | null;
  holdEndSec: number | null;
}

interface Beat {
  id: number;
  timeSec: number;
  lane: number;
  matched: boolean;
  holdDurationSec: number;
  toneHz: number;
}

type ChartPoint = Required<ChartStep>;

function normalizeChart(input: number[] | ChartStep[]): ChartPoint[] {
  if (input.length === 0) {
    return [
      { lane: 0, spacingBeats: 1, holdBeats: 0, toneHz: 220 },
      { lane: 1, spacingBeats: 1, holdBeats: 0, toneHz: 275 },
      { lane: 2, spacingBeats: 1, holdBeats: 0, toneHz: 330 },
      { lane: 3, spacingBeats: 1, holdBeats: 0, toneHz: 385 },
    ];
  }

  if (typeof input[0] === 'number') {
    return (input as number[]).map((lane) => ({
      lane: Math.max(0, Math.min(3, Math.floor(lane))),
      spacingBeats: 1,
      holdBeats: 0,
      toneHz: 220 + lane * 55,
    }));
  }

  return (input as ChartStep[]).map((step) => ({
    lane: Math.max(0, Math.min(3, Math.floor(step.lane))),
    spacingBeats: Math.max(0.5, step.spacingBeats ?? 1),
    holdBeats: Math.max(0, step.holdBeats ?? 0),
    toneHz: Math.max(120, Math.min(1200, step.toneHz ?? 220 + step.lane * 55)),
  }));
}

export class RhythmEngine {
  private readonly beats: Beat[] = [];

  private nextBeatTimeSec: number;

  private beatId = 0;

  private readonly beatIntervalSec: number;

  private readonly chart: ChartPoint[];

  constructor(bpm: number, startTimeSec: number, chart: number[] | ChartStep[] = [0, 1, 2, 3]) {
    this.beatIntervalSec = 60 / Math.max(1, bpm);
    this.nextBeatTimeSec = startTimeSec;
    this.chart = normalizeChart(chart);
  }

  update(nowSec: number): void {
    while (this.nextBeatTimeSec <= nowSec + this.beatIntervalSec * 6) {
      const step = this.chart[this.beatId % this.chart.length];
      this.beats.push({
        id: this.beatId,
        timeSec: this.nextBeatTimeSec,
        lane: step?.lane ?? 0,
        matched: false,
        holdDurationSec: this.beatIntervalSec * (step?.holdBeats ?? 0),
        toneHz: step?.toneHz ?? 220,
      });
      this.beatId += 1;
      this.nextBeatTimeSec += this.beatIntervalSec * (step?.spacingBeats ?? 1);
    }

    while (this.beats.length > 0 && nowSec - this.beats[0].timeSec > 2) {
      this.beats.shift();
    }
  }

  evaluateLaneHit(hitTimeSec: number, rules: DanceRules, lane: number): HitEvaluation {
    let target: Beat | null = null;
    let bestOffset = Number.POSITIVE_INFINITY;

    for (const beat of this.beats) {
      if (beat.matched) {
        continue;
      }
      if (beat.lane !== lane) {
        continue;
      }

      const offset = hitTimeSec - beat.timeSec;
      const absOffset = Math.abs(offset);
      if (absOffset < bestOffset) {
        target = beat;
        bestOffset = absOffset;
      }
    }

    if (!target) {
      return {
        judgement: 'PRALEISTA',
        timing: 'none',
        noteType: 'tap',
        beatId: null,
        holdEndSec: null,
      };
    }

    const offset = hitTimeSec - target.timeSec;
    const judgement = calculateJudgement(offset, rules);
    if (judgement !== 'PRALEISTA') {
      target.matched = true;
      return {
        judgement,
        timing: 'on-time',
        noteType: target.holdDurationSec > 0 ? 'hold' : 'tap',
        beatId: target.id,
        holdEndSec: target.holdDurationSec > 0 ? target.timeSec + target.holdDurationSec : null,
      };
    }

    // Missed attempts also consume the targeted note so the player
    // cannot retry the exact same note.
    target.matched = true;

    return {
      judgement,
      timing: offset < 0 ? 'early' : 'late',
      noteType: target.holdDurationSec > 0 ? 'hold' : 'tap',
      beatId: target.id,
      holdEndSec: null,
    };
  }

  registerLaneHit(hitTimeSec: number, rules: DanceRules, lane: number): Judgement {
    return this.evaluateLaneHit(hitTimeSec, rules, lane).judgement;
  }

  registerHit(hitTimeSec: number, rules: DanceRules): Judgement {
    let target: Beat | null = null;
    let bestOffset = Number.POSITIVE_INFINITY;

    for (const beat of this.beats) {
      if (beat.matched) {
        continue;
      }

      const offset = hitTimeSec - beat.timeSec;
      const absOffset = Math.abs(offset);
      if (absOffset < bestOffset) {
        target = beat;
        bestOffset = absOffset;
      }
    }

    if (!target) {
      return 'PRALEISTA';
    }

    const judgement = calculateJudgement(hitTimeSec - target.timeSec, rules);
    if (judgement !== 'PRALEISTA') {
      target.matched = true;
    }

    return judgement;
  }

  consumeMissed(nowSec: number, missWindowSec: number): number {
    let count = 0;
    for (const beat of this.beats) {
      if (beat.matched) {
        continue;
      }

      if (nowSec - beat.timeSec > missWindowSec) {
        beat.matched = true;
        count += 1;
      }
    }

    return count;
  }

  getBeatsInRange(
    startSec: number,
    endSec: number,
  ): Array<{ id: number; timeSec: number; lane: number; holdDurationSec: number; toneHz: number }> {
    return this.beats
      .filter((beat) => !beat.matched && beat.timeSec >= startSec && beat.timeSec <= endSec)
      .map((beat) => ({
        id: beat.id,
        timeSec: beat.timeSec,
        lane: beat.lane,
        holdDurationSec: beat.holdDurationSec,
        toneHz: beat.toneHz,
      }));
  }

  getUpcoming(nowSec: number, horizonSec: number): number[] {
    return this.beats
      .filter((beat) => beat.timeSec >= nowSec && beat.timeSec <= nowSec + horizonSec)
      .map((beat) => beat.timeSec);
  }
}
