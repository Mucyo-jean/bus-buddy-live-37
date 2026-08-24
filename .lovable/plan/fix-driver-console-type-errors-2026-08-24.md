# Fix driver console type errors

The type checker currently fails on the driver page (and one related spot on the passenger page). No behaviour changes — only making the code type-clean.

## What's wrong

1. `startTrip` and `endTrip` in `src/routes/driver.tsx` mix `return toast.error(...)` early-exits with paths that return nothing, so TypeScript flags "not all code paths return a value" (TS7030).
2. The live map is passed `nextStopId` as possibly `undefined`, but it expects `string | null` — this affects both the driver and passenger pages.

## Changes

- `src/routes/driver.tsx`
  - Rewrite the guard clauses in `startTrip` and `endTrip` so each early exit is a statement block (`{ toast.error(...); return; }`) instead of returning the toast's value. Same for the error branches after the database calls.
  - Pass `nextStopId={state.nextStop?.id ?? null}` to the map.
- `src/routes/passenger.tsx`
  - Same `nextStopId` null-coalescing fix on the map.

## Verification

Run the type check and confirm zero errors, then confirm the driver page still starts/ends a trip in the preview.
