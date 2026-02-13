# LayoutManager Spec

## Responsibilities

- Apply responsive dimensions for canvas/editor panels.
- Respect safe-area insets.

## Inputs

- viewport width/height
- device pixel ratio

## Outputs

- `LayoutMetrics`

## Invariants

- Canvas pixel size matches CSS size \* DPR.
- Minimum touch target size >= 44px.

## Mobile Constraints

- iPhone portrait-first layout.
- No horizontal scrolling for core gameplay.

## Performance Constraints

- Recalculate only on resize/orientation change.
