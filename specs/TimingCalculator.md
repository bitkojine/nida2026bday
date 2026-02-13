# TimingCalculator Spec

## Responsibilities

- Convert timing offset into `TOBULA`, `GERAI`, `PRALEISTA`.
- Keep judgement deterministic.

## Inputs

- `offsetSec: number`
- `tobulasLangas: number`
- `gerasLangas: number`

## Outputs

- `Judgement`

## Invariants

- Uses absolute offset.
- `TOBULA` has priority over `GERAI`.
- Invalid windows are sanitized to safe minimums.

## Mobile Constraints

- Must handle high-frequency touch input.

## Performance Constraints

- Pure function, constant-time.
