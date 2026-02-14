import { describe, expect, test } from 'vitest';
import { planSongPlaybackBatch, type SongPlaybackBeat } from '../src/core/songPlaybackPlanner';

function beat(id: number, timeSec: number): SongPlaybackBeat {
  return {
    id,
    timeSec,
    toneHz: 220 + id,
    holdDurationSec: 0,
  };
}

describe('songPlaybackPlanner', () => {
  test('queues notes while locked and plays them after unlock', () => {
    const locked = planSongPlaybackBatch({
      nowSec: 10,
      unlocked: false,
      windowBeats: [beat(1, 10)],
      pendingBeats: [],
      playedBeatIds: new Set<number>(),
      maxPendingAgeSec: 1.2,
      maxPendingCount: 24,
    });
    expect(locked.toPlay).toHaveLength(0);
    expect(locked.pending.map((item) => item.id)).toEqual([1]);

    const unlocked = planSongPlaybackBatch({
      nowSec: 10.6,
      unlocked: true,
      windowBeats: [],
      pendingBeats: locked.pending,
      playedBeatIds: new Set<number>(),
      maxPendingAgeSec: 1.2,
      maxPendingCount: 24,
    });
    expect(unlocked.pending).toHaveLength(0);
    expect(unlocked.toPlay.map((item) => item.id)).toEqual([1]);
  });

  test('drops stale pending notes beyond age budget', () => {
    const result = planSongPlaybackBatch({
      nowSec: 10,
      unlocked: true,
      windowBeats: [],
      pendingBeats: [beat(1, 8.5), beat(2, 9.2)],
      playedBeatIds: new Set<number>(),
      maxPendingAgeSec: 1,
      maxPendingCount: 24,
    });
    expect(result.toPlay.map((item) => item.id)).toEqual([2]);
  });

  test('does not replay already played notes and keeps queue capped', () => {
    const result = planSongPlaybackBatch({
      nowSec: 20,
      unlocked: false,
      windowBeats: [beat(5, 20.1), beat(6, 20.2)],
      pendingBeats: [beat(1, 19.8), beat(2, 19.9), beat(5, 20.1)],
      playedBeatIds: new Set<number>([2]),
      maxPendingAgeSec: 2,
      maxPendingCount: 3,
    });
    expect(result.toPlay).toHaveLength(0);
    expect(result.pending.map((item) => item.id)).toEqual([1, 5, 6]);
  });
});
