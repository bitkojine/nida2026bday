# ErrorTranslator Spec

## Responsibilities

- Convert technical compiler errors into friendly Lithuanian text.

## Inputs

- `error message`

## Outputs

- Localized user-facing text.

## Invariants

- Output always non-empty.
- Original technical detail retained when unknown.

## Mobile Constraints

- Short, readable lines on narrow screens.

## Performance Constraints

- Constant-time mapping by keyword rules.
