export interface BeatCoachState {
  label: string;
  progress: number;
  urgent: boolean;
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

export function buildBeatCoachState(
  nowSec: number,
  nextBeatSec: number | null,
  horizonSec = 2,
): BeatCoachState {
  if (nextBeatSec === null) {
    return {
      label: 'Laukiama ritmo...',
      progress: 0,
      urgent: false,
    };
  }

  const delta = nextBeatSec - nowSec;
  if (Math.abs(delta) <= 0.08) {
    return {
      label: 'DABAR!',
      progress: 1,
      urgent: true,
    };
  }

  const progress = clamp01(1 - delta / Math.max(0.5, horizonSec));
  return {
    label: delta > 0 ? `Kitas ritmas po ${delta.toFixed(2)} s` : 'Per velai - lauk kito ritmo',
    progress,
    urgent: false,
  };
}
