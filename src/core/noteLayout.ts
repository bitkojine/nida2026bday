export const NOTE_TOP_PERCENT = 6;
export const NOTE_BOTTOM_PERCENT = 96;
export const HIT_LINE_PERCENT = 85;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeNoteYPercent(deltaSec: number, leadSec: number, trailSec: number): number {
  if (deltaSec >= 0) {
    const ratio = clamp(deltaSec / Math.max(0.001, leadSec), 0, 1);
    return HIT_LINE_PERCENT - ratio * (HIT_LINE_PERCENT - NOTE_TOP_PERCENT);
  }

  const ratio = clamp(-deltaSec / Math.max(0.001, trailSec), 0, 1);
  return HIT_LINE_PERCENT + ratio * (NOTE_BOTTOM_PERCENT - HIT_LINE_PERCENT);
}
