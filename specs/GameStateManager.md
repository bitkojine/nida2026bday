# GameStateManager Spec

## Responsibilities

- Hold deterministic game session state.
- Transition between splash/start/playing/paused.

## Inputs

- User actions and beat judgements.

## Outputs

- New immutable state snapshot.

## Invariants

- State transitions follow allowed graph.
- Score data resets only on explicit restart.

## Mobile Constraints

- Fast restart and pause interactions.

## Performance Constraints

- No deep clone of large data per frame.
