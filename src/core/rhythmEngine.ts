import { calculateJudgement } from './timingCalculator';
import type { DanceRules, Judgement } from './types';

export type HitTiming = 'on-time' | 'early' | 'late' | 'none';

export interface HitEvaluation {
  judgement: Judgement;
  timing: HitTiming;
}

interface Beat {
  id: number;
  timeSec: number;
  lane: number;
  matched: boolean;
}

export class RhythmEngine {
  private readonly beats: Beat[] = [];

  private nextBeatTimeSec: number;

  private beatId = 0;

  private readonly beatIntervalSec: number;

  private readonly lanePattern: number[];

  constructor(bpm: number, startTimeSec: number, lanePattern: number[] = [0, 1, 2, 3]) {
    this.beatIntervalSec = 60 / Math.max(1, bpm);
    this.nextBeatTimeSec = startTimeSec;
    this.lanePattern = lanePattern.length > 0 ? lanePattern : [0, 1, 2, 3];
  }

  update(nowSec: number): void {
    while (this.nextBeatTimeSec <= nowSec + this.beatIntervalSec * 4) {
      this.beats.push({
        id: this.beatId,
        timeSec: this.nextBeatTimeSec,
        lane: this.lanePattern[this.beatId % this.lanePattern.length] ?? 0,
        matched: false,
      });
      this.beatId += 1;
      this.nextBeatTimeSec += this.beatIntervalSec;
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
      };
    }

    const offset = hitTimeSec - target.timeSec;
    const judgement = calculateJudgement(offset, rules);
    if (judgement !== 'PRALEISTA') {
      target.matched = true;
      return {
        judgement,
        timing: 'on-time',
      };
    }

    return {
      judgement,
      timing: offset < 0 ? 'early' : 'late',
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
  ): Array<{ id: number; timeSec: number; lane: number }> {
    return this.beats
      .filter((beat) => !beat.matched && beat.timeSec >= startSec && beat.timeSec <= endSec)
      .map((beat) => ({ id: beat.id, timeSec: beat.timeSec, lane: beat.lane }));
  }

  getUpcoming(nowSec: number, horizonSec: number): number[] {
    return this.beats
      .filter((beat) => beat.timeSec >= nowSec && beat.timeSec <= nowSec + horizonSec)
      .map((beat) => beat.timeSec);
  }
}
