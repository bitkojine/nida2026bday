# CodeCompilerService Spec

## Responsibilities

- Compile/validate user C# dance rules in browser.
- Produce safe, bounded runtime rules.
- Expose Lithuanian compile errors.

## Inputs

- `csharpSource: string`

## Outputs

- `CompileResult { success, rules, errors, mode }`

## Invariants

- Sandbox clamps unsafe values.
- Compilation errors never crash game loop.
- Last valid rules remain active on failure.

## Mobile Constraints

- Debounced compile while typing to protect battery.

## Performance Constraints

- Compile budget: < 30ms average for template edits.
