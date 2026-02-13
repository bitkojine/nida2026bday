# HorseAnimator Spec

## Responsibilities

- Render horse with visual state tied to judgement.
- Animate states: TOBULA, GERAI, PRALEISTA, UŽSIVEDIMAS.

## Inputs

- `canvas context`
- `animation time`
- `horse mood state`

## Outputs

- Drawn frame.

## Invariants

- Canvas always cleared before redraw.
- Rendering bounded to canvas area.

## Mobile Constraints

- Legible at iPhone portrait widths.
- No hover interactions required.

## Performance Constraints

- 60fps target on modern iPhone hardware.
- Minimal overdraw and low object churn.
