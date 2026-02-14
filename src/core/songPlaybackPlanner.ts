export interface SongPlaybackBeat {
  id: number;
  timeSec: number;
  toneHz: number;
  holdDurationSec: number;
}

interface PlanSongPlaybackBatchInput {
  nowSec: number;
  unlocked: boolean;
  windowBeats: SongPlaybackBeat[];
  pendingBeats: SongPlaybackBeat[];
  playedBeatIds: ReadonlySet<number>;
  maxPendingAgeSec: number;
  maxPendingCount: number;
}

interface PlanSongPlaybackBatchResult {
  toPlay: SongPlaybackBeat[];
  pending: SongPlaybackBeat[];
}

export function planSongPlaybackBatch(
  input: PlanSongPlaybackBatchInput,
): PlanSongPlaybackBatchResult {
  const pendingById = new Map<number, SongPlaybackBeat>();

  for (const beat of input.pendingBeats) {
    if (input.playedBeatIds.has(beat.id)) {
      continue;
    }
    if (input.nowSec - beat.timeSec > input.maxPendingAgeSec) {
      continue;
    }
    pendingById.set(beat.id, beat);
  }

  for (const beat of input.windowBeats) {
    if (input.playedBeatIds.has(beat.id)) {
      continue;
    }
    pendingById.set(beat.id, beat);
  }

  const pendingSorted = Array.from(pendingById.values()).sort((a, b) => a.timeSec - b.timeSec);
  const cappedPending =
    pendingSorted.length > input.maxPendingCount
      ? pendingSorted.slice(pendingSorted.length - input.maxPendingCount)
      : pendingSorted;

  if (!input.unlocked) {
    return { toPlay: [], pending: cappedPending };
  }

  return { toPlay: cappedPending, pending: [] };
}
