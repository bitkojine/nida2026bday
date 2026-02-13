# InputController Spec

## Responsibilities

- Normalize touch/mouse/keyboard to lane hits.

## Inputs

- Pointer X position and container width.
- Keyboard key.

## Outputs

- `laneIndex | null`

## Invariants

- Result is between `0` and `laneCount - 1`.
- Out-of-range coordinates clamp safely.

## Mobile Constraints

- Thumb-friendly lane buttons.
- Multi-touch should not corrupt lane mapping.

## Performance Constraints

- O(1) normalization.
