# RuntimeCoordinator Spec

## Problem Statement

- `src/main.ts` currently mixes rendering, input, compile lifecycle, persistence, and dialog workflows in one mutable runtime.
- Multiple async sources can interleave:
  - debounced compile timers
  - `requestAnimationFrame` loop and resize stabilization frames
  - async unlock-code hashing
  - async memory/storage sampling
  - editor mode switches (Monaco <-> fallback)
- Existing guards are partial (`disposed`, timer clears, local validation ids), but ordering is not globally enforced.

## Goals

- Remove race-condition class bugs by design, not by patching call sites.
- Make state transitions deterministic and replayable from events.
- Keep current gameplay behavior and UI feature set unchanged during migration.
- Enable spec-driven incremental refactors with measurable acceptance criteria.

## Non-Goals

- No rewrite of `RhythmEngine`, `GameAudio`, or `HorseAnimator` internals.
- No visual redesign.
- No behavior changes to mission rules, storage keys, or danger-zone semantics.

## Proposed Architecture

### 1) State Store (Single Source of Truth)

- Introduce `AppState` with domain slices:
  - `gameplay`: score, streak, holds, autoplay, mood, played-beat tracking
  - `rules`: current effective `DanceRules`
  - `compile`: editor source, validity, latest result, notice expanded, request epochs
  - `ui`: dialog open states, layout mode, resize/viewport data
  - `persistence`: hydrated flags, pending writes, last persisted snapshots
  - `runtime`: disposed flag, lifecycle phase, active frame ids
  - `diagnostics`: fps, frame ms, memory/storage samples

### 2) Event Queue

- All mutations happen through `dispatch(event)`.
- Event kinds (initial set):
  - lifecycle: `BOOTSTRAP_STARTED`, `BOOTSTRAP_DONE`, `TEARDOWN`
  - editor: `EDITOR_SOURCE_CHANGED`, `EDITOR_MODE_CHANGED`
  - compile: `COMPILE_REQUESTED`, `COMPILE_SUCCEEDED`, `COMPILE_FAILED`
  - input: `LANE_PRESSED`, `LANE_RELEASED`, `KEY_DOWN`, `KEY_UP`
  - frame: `FRAME_TICK`, `RESIZE_OBSERVED`
  - dialogs: `DIALOG_OPENED`, `DIALOG_CLOSED`, `DIALOG_INPUT_CHANGED`, `DIALOG_CONFIRMED`
  - persistence: `PERSIST_REQUESTED`, `PERSIST_APPLIED`, `PERSIST_FAILED`, `HYDRATE_DONE`
  - diagnostics: `PERF_SAMPLE_REQUESTED`, `PERF_SAMPLE_RECEIVED`

### 3) Reducer + Effect Separation

- Reducer:
  - pure, synchronous, no DOM/network/storage/timer APIs
  - returns `nextState` + declarative `effects[]`
- Effect runner:
  - executes side effects (compile, localStorage, timers, DOM writes, focus, reload)
  - emits completion events back to queue

### 4) Epoch/Token Concurrency Control

- Each async pipeline has a monotonic epoch:
  - `compileEpoch`
  - `dialogValidationEpoch`
  - `perfSampleEpoch`
  - `resizeEpoch`
- Completion events carry epoch; reducer drops stale events.
- Rule: only latest epoch may mutate user-visible state.

### 5) Render Contract

- Rendering reads snapshot state and performs idempotent updates.
- No render function may mutate gameplay/compile/persistence state.
- Render targets split:
  - `renderHud(state)`
  - `renderLanes(state, now)`
  - `renderHorse(state, now)`
  - `renderWeather(state, now)`
  - `renderNotices(state)`
  - `renderDialogs(state)`
  - `renderPerf(state)`

## Key Invariants

- `compile.valid === true` => both compile notices hidden.
- Compile results are applied only if `result.epoch === state.compile.activeEpoch`.
- Persisted editor source is last-write-wins by epoch.
- `TEARDOWN` is terminal: no later async completion mutates state.
- UI toggles and dialog buttons never directly mutate unrelated domains.

## Migration Plan (Spec-Driven)

### Phase 0: Baseline Harness

- Add deterministic runtime test harness for event/reducer/effect flow.
- Freeze current behavior with regression tests for:
  - compile validity transitions
  - notice visibility
  - danger-zone workflows
  - editor persistence and reload behavior

### Phase 1: Compile Pipeline First

- Move compile flow behind queue/reducer/effects:
  - `EDITOR_SOURCE_CHANGED` schedules debounced `COMPILE_REQUESTED(epoch)`
  - effect runs compiler and dispatches success/failure with same epoch
  - stale compile completions ignored
- Keep existing UI unchanged.

### Phase 2: Dialog + Async Validation

- Route danger-zone input and confirmations through events.
- Move unlock-code validation to epoch-gated effect flow.
- Remove ad-hoc local `validationId` counters from UI callbacks.

### Phase 3: Frame/Resize Scheduling

- Represent frame and resize work as events.
- Keep a single scheduler ownership for RAF and resize stabilization.
- Ensure no duplicate loops after lifecycle transitions.

### Phase 4: Persistence Gateway

- Centralize localStorage read/write in effect layer.
- Reducer emits persistence intents; effect commits and reports status.
- Keep current keys and migration behavior (`puzzlesUnlocked:v1` -> `puzzlesSolvedCount:v1`).

### Phase 5: Main.ts Decomposition

- Extract runtime coordinator and domain modules from `src/main.ts`.
- `main.ts` becomes bootstrap wiring + root render registration.

## Testing Strategy

### Unit (new)

- reducer determinism (same event stream => same final state)
- stale epoch rejection for compile/dialog/perf pipelines
- terminal teardown invariant

### Integration (new)

- compile storm: rapid edits + debounce + mode switch
- resize storm during codebox drag and orientation changes
- dialog open/close with rapid input and Enter/Escape races

### E2E (extend existing)

- rapid sequence: invalid code -> valid code -> invalid code during resize
- reload during pending compile request
- code reset and full reset during active autoplay
- verify no post-teardown state resurrection

## Acceptance Criteria

- No known race-condition bugs reproducible with scripted stress tests.
- Compile-notice state remains consistent under rapid edits and resizes.
- LocalStorage state remains coherent after reload under concurrent UI actions.
- `src/main.ts` loses orchestration complexity (coordinator owns async flow).

## Current Risk Hotspots (from audit)

- `src/main.ts` compile debounce + editor mode fallback/Monaco split paths.
- `src/main.ts` parallel async samplers (`sampleMemoryText`, `sampleLocalStorageStats`).
- `src/main.ts` direct DOM listeners mutating shared mutable state across domains.
