# Gameplay / scoring QA

## Request

Make throws travel more toward the hoop, check that legitimate baskets register,
and publish the changes to the existing GitHub repository. Keep WebGL, physical
rim/backboard collisions and touch controls. No APK build.

## Reproduction and fix

Before the fix, `node --test --test-name-pattern='nudged|incoming balls|normal leftward' tests/physics.test.mjs`
failed all three scenarios: contact-dunk count was 0 instead of 1; a toss peaked
at x=926.54 in a 1280-wide court; an ordinary leftward flick missed.

The contact-dunk bug was a missing scoring path, not a need to enlarge the basket:
ball-ball overlap correction bypassed both rim collision and scoring checks.
Contact movement now uses bounded substeps and checks the same gate as free flight
and held dragging. A scored object is excluded from further contact response.
Alley-oop contact credit is assigned before the separation can complete a basket,
so the dunk retains its trick bonus.

Incoming arcs now approach the central lane. Assisted releases use a one-time
ballistic correction, with a minimum descent slope to avoid shallow near-rim hits.
The shared preview uses the actual launch calculation, drag, gravity and spin.
It also uses the same active Magnet force as the real flight simulation.

## Automated coverage

Command: `npm test`.

- 405 clean-entry scenarios: 3 modes × 5 ball variants × 3 frame rates
  (20/60/120 FPS) × 3 downward speeds × 3 offsets. Each must score once, and attempts
  to rescore the same ball must leave both score and dunk count unchanged.
- 135 ordinary assisted-flick scenarios: 3 court widths × 5 variants × 3 frame
  rates × 3 swipe speeds. Each must complete a physical basket.
- 45 invalid-entry checks: upward, outside, and already-below-rim entries for
  each mode and ball variant must award zero points.
- Contact-pushed entry, held dunk, upward-to-downward gesture, stopped release,
  rim/backboard tunnelling, rebound entry, pause, buzzer and GPU-loss regressions.
- Untouched spawns must not auto-score; taps/reverse throws/bombs/close dunks are
  not auto-aimed. The guide must match the actual released trajectory.
- Existing native WebGL renderer tests remain part of the suite.

## Limits

Passing cases establish the specified gate behavior, not that every visually near
shot is a basket. The whole ball must cross downward between the physical rim lips;
sideways/upward passes and genuine rim deflections should not count. Overlapping
objects and human gestures have unbounded combinations. Actual touchscreen feel,
browser/device performance and low-end phone testing still need physical-device QA.
