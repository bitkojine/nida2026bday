# ScoreSystem Spec

## Responsibilities

- Compute score from judgement and rules.
- Track streak and hype activation.

## Inputs

- `judgement: Judgement`
- `state: ScoreState`
- `rules: DanceRules`

## Outputs

- Updated `ScoreState`

## Invariants

- Miss resets streak.
- Hype enabled when streak reaches `serijaIkiHype`.
- Score never decreases.

## Mobile Constraints

- Immediate feedback on tap (same frame target).

## Performance Constraints

- Constant-time update.
