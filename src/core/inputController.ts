const KEY_TO_LANE: Record<string, number> = {
  a: 0,
  s: 1,
  k: 2,
  l: 3,
  arrowleft: 0,
  arrowdown: 1,
  arrowup: 2,
  arrowright: 3,
};

export function normalizeLaneFromX(x: number, width: number, laneCount: number): number {
  if (laneCount <= 1 || width <= 0) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(x, width - 1));
  const laneWidth = width / laneCount;
  return Math.min(laneCount - 1, Math.floor(clamped / laneWidth));
}

export function normalizeLaneFromKey(key: string): number | null {
  return KEY_TO_LANE[key.toLowerCase()] ?? null;
}
