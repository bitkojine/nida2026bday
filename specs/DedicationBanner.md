# DedicationBanner Spec

## Responsibilities

- Render celebratory dedication text in Lithuanian.
- Ensure visible on splash and start screens.

## Inputs

- Current screen key.

## Outputs

- Visibility boolean and themed text.

## Invariants

- Meaning stays: For Nida by Robertas. Happy birthday.
- Text is never hidden behind scroll on iPhone viewport.

## Mobile Constraints

- Must be readable without scrolling on 390x844 viewport.

## Performance Constraints

- Animation uses CSS opacity/transform only.
