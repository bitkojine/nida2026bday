# RhythmEngine Spec

## Responsibilities

- Schedule deterministic beat timestamps from BPM.
- Match player hits to nearest unmatched beat.
- Emit judgement candidates for scoring.

## Inputs

- `bpm: number`
- `startTimeSec: number`
- `nowSec: number`
- `hitTimeSec: number`
- `goodWindowSec: number`

## Outputs

- `Beat[]`
- `HitMatch | null`

## Invariants

- Beat interval is `60 / bpm`.
- Each beat can be matched once.
- No negative timestamps.

## Mobile Constraints

- Works with touch bursts and low-latency taps.
- Avoid frame-dependent logic; use wall-clock times.

## Performance Constraints

- O(1) amortized beat generation.
- Avoid allocations inside hot frame loop.
