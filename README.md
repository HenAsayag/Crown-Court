# CROWN COURT

*Rule the rim.*

A **landscape** swipe-to-dunk arcade high-score chaser, played on its side. The canvas
fills the screen edge to edge on any phone. Original code, original art direction, no
copied assets or trademarks. The hoop sits on the left; balls and bombs are launched up
from the bottom, and you drag balls into the net and sweep bombs out over the sides.

## Current gameplay revision

### Playable arcs and scoring QA

- Incoming balls now travel from the lower right toward the central catching lane,
  while untouched tosses remain short of the hoop.
- Deliberate hoop-directed flicks and held releases receive a one-time ballistic
  launch correction that accounts for gravity, drag and spin, including enough
  descent angle to clear the near rim. The trajectory is not steered during flight.
- Taps, reverse throws, close-range dunks and bombs remain unassisted.
- Canvas and WebGL share the same trajectory preview and launch calculation.
- Fixed a missed-basket case: contact separation between two balls could move a
  ball through the opening without running the scoring check. Separation now
  traverses the same solid colliders and scoring gate, in bounded steps.

`npm test` includes cross-mode clean-entry, duplicate-score, invalid-entry,
assisted-shot, contact-dunk and preview/release regression matrices. These are
deterministic engine checks, not a guarantee about every possible player gesture.
See [the QA report](docs/gameplay-qa.md) for coverage and limitations.

### WebGL renderer

WebGL is now the default renderer for the 2D court, hoop layers, balls, bombs,
crowns, trails and particles. Sprites are GPU textures; circles, rings and glows
are shader-drawn. Small offscreen canvases prepare masked sprites and text only:
the game does not render a full Canvas frame and copy it into WebGL.
Menus remain accessible HTML/CSS. Both renderers share one physics and scoring engine.

The home screen reports `WEBGL · GPU`. Unsupported devices automatically use the
original Canvas renderer (`CANVAS · COMPATIBILITY MODE`). For comparison, open
`/?nosw=1&renderer=canvas`. GPU context loss pauses an active run; textures rebuild
after restoration, and the player can resume from the pause menu.
No third-party runtime, CDN, APK or 3D gameplay conversion is required.

- Illustrated home, mode selection, locker, and an in-game control guide.
- The supplied street-hoop artwork is rendered in back/front layers. Balls fall behind
  the front rim and net; the board stays fixed and the net reacts to a dunk.
- Rim and scoring dimensions share measured artwork anchors. The outer rim is about
  2.3 times the classic ball diameter. Its playable opening remains fixed.
- Balls rise in varied arcs from the lower-right catching lane, at 70% of the previous
  wave frequency (bomb odds and double-wave odds are unchanged).
- Held releases use 0.52 power instead of 0.85, with a 1050 raw impulse cap; assisted
  long-range arcs and quick flicks remain available. The preview uses the same launch.
- Scoring uses the actual downward path through the opening, not averaged gesture velocity.
  This fixes missed hand dunks after a quick upward-to-downward change of direction.
- Fast throws and held drags are subdivided for collision checks. A ball cannot be dragged
  sideways through the rim or through the raised backboard strike area.
- Pause freezes gameplay, and a stopped release drops the ball without stale momentum.

Run the deterministic engine regressions with `npm test`. The suite uses the real game
engine with inert DOM/audio adapters; it does not modify browser saves. Fine tuning of
touch feel should also be checked on a physical phone. No new APK is part of this revision.

**Controls.** Press a ball and it sticks to your finger — drag it where you want and let
go to throw it at the speed your finger was moving. A fast swipe that merely passes
*through* a ball flicks it too, so a deliberate drag and a quick slash both work. Let go
without moving and the ball simply drops. Carrying a ball straight into the net also
counts - a plain placement scores the base value and keeps the combo. Demonstrated
handling tricks also count on hand finishes. Each ball scores only once.

**Four new handling bonuses.** Carry broad left-right-left strokes for CROSSOVER (+170),
up-down-up for DOUBLE PUMP (+190), or a closed circle at least 120 world units wide and
tall for 360 JAM (+230). SELF ALLEY-OOP (+210) needs an upward release, at least 0.18s
airtime, and a catch 90 units higher, then a dunk. Strokes need 90 units of travel;
small finger jitter and dragging against a wall do not count. Bonuses can stack and
use the existing variety/combo/style multipliers. You can hold for up to 3.5s.

**Mobile feedback.** Scores use short vibration pulses and penalty explosions use a
longer double pulse. Small contact taps cannot interrupt those patterns. The existing
sound mute also disables vibration. This is best-effort browser haptics: unsupported
browsers safely skip it; browser vibration controls pulse duration, not motor intensity.
See [Vibration API support](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API).

**Skills.** Keep a ball alive instead of banking it straight away and it builds **style**.
Flick it back up on a rhythm, hit it off-centre to load it with spin, pop it high — every
deliberate juggle raises the ball's level (NICE → SLICK → FANCY → SHOWTIME → UNREAL) and
multiplies the whole dunk, up to **x3.5**. The ball glows brighter at every level and
carries its multiplier as a badge. Juggling costs tempo, so it is a real trade: a worked
ball is worth several plain ones, but plain ones come faster.

---

## Play it

**On Android:** the optional local `crown-court.apk` is an earlier build, not this gameplay revision
and is not tracked in Git. Copy it to the phone and open it; Android will
ask you to allow installs from this source. It is fully offline — the only permission it
requests is `VIBRATE`.

**In a browser:** the game must be served over `http://`; `localStorage` and PWA install
do not work from a `file://` URL.

```bash
npm ci
npm run dev
```

Then open <http://localhost:8123>. Append `?nosw=1` to skip the service worker while
developing, so a reload always fetches fresh code.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Shell: all CSS, the DOM screens and the HUD. |
| `game.js` | The whole engine. `CONFIG` is the first thing in the file. |
| `arena.css` | Responsive illustrated menus and gameplay HUD. |
| `art.js` | Supplied texture-atlas coordinates for UI and ball art. |
| `hoop-art.js` | Back/front rendering layers of the street hoop. |
| `tests/physics.test.mjs` | Deterministic scoring, collision, and input regressions. |
| `sw.js` | Service worker — offline play and PWA installability. |
| `manifest.webmanifest` | PWA manifest (landscape). |
| `assets/` | Sprites cut from your four sheets (~1.2 MB of WebP). |
| `crown-court.apk` | Optional earlier local build; excluded from Git. |
| `android/` | Capacitor project: landscape-locked, fullscreen, no INTERNET permission. |
| `build-apk.sh` | One-command APK rebuild (`npm run apk`). |
| `build-www.mjs` | Copies the game into `www/` for the Android build. |
| `tools/prep.html` | The offline asset pipeline (see below). |
| `.toolchain/` | JDK 21 + Android SDK + Gradle cache, all project-local (1.9 GB). Delete it to reclaim the space; `npm run apk` will need it again. |
| `.raw/` | Copies of your four original PNGs. Only needed to re-run the pipeline — safe to delete. |
| `server.mjs` | Dev server. Also accepts `POST /save` for the asset pipeline. Not part of the game. |
| `rim-city.html` | The earlier standalone game, kept so it isn't lost. |

## Android

To rebuild the APK after changing the game:

```bash
npm run apk
```

Everything the build needs lives in `.toolchain/` — nothing was installed system-wide and
no environment variables were changed. For a release build, pass `assembleRelease` and
sign the unsigned output with your own key.

### Two gotchas worth recording

**AF_UNIX sockets.** This machine blocks them in the default `TEMP` directory (ZoneAlarm
shows up in the network interface list). That makes `Selector.open()` throw *"Unable to
establish loopback connection"*, which kills every Gradle daemon connection before the
build even starts. The fix, applied in `build-apk.sh` and `android/gradle.properties`, is
`-Djdk.net.unixdomain.tmpdir` pointed at a directory inside the project.

**Backslashes in `.properties` files.** They are escape characters, so a Windows path
written with single backslashes silently collapses to nonsense. `local.properties` and
`gradle.properties` therefore use forward slashes, which Java accepts on Windows.

## Balancing

Everything tunable is in the `CONFIG` object at the top of `game.js`, grouped by concern:

- `WORLD` — reference height (720) plus the aspect clamps the width is derived from
- `PHYSICS` — gravity, drag, Magnus (spin curve), restitution, radii
- `SWIPE` — flick power, grab-and-drag behaviour, spin from off-centre hits, and the
  ball-vs-bomb precision rules
- `HOOP` — rim and backboard geometry as fractions of the hoop sprite, so art and
  collision can never drift apart
- `SPAWN` — throw rate, bomb ratio, the difficulty ramp, the bomb safe-distance rule
- `COMBO` — decay window, multiplier ladder, variety bonus, repeat decay
- `SCORE`, `CROWNS`, `RANK` — points, currency, progression
- `MODES`, `OVERTIME`, `HELPER` — per-mode rules, overtime trigger, ability meter rates
- `STYLE` — the skill system: what a juggle is worth, the rhythm gate, level thresholds
  and the multiplier per level
- `JUICE` — shake, slow-motion, trails, particles, haptics, flashes
- `AUDIO`, `PLAYER` — mix levels and personalisation

Nothing outside `CONFIG` hard-codes a balance number.

## The asset pipeline

Your sheets came with baked-in background gradients, so the sprites had to be cut out
before they could be drawn over the court. `tools/prep.html` does that offline:

1. Loads the four raw sheets from `.raw/`.
2. **Knockout** — region-grows from the image border inward, joining a pixel to the
   background when it is within a tolerance of the neighbour it was reached from. That
   follows a smooth gradient but stops dead at the artwork's dark outlines.
3. **Connected components** — labels what is left, then groups blobs to named anchors and
   copies each group by its label mask, so a limb crossing a cell border stays with its
   own pose and neighbouring sprites can never bleed into each other.
4. **Trim, scale and export** to WebP via `POST /save`.

Ball, court and crown variants are colour grades of the same source art, generated the
same way.

To re-run it: start the server, open <http://localhost:8123/tools/prep.html>, and drive
the exposed helpers (`SPR`, `POSES`, `knockout`, `tidy`, `saveWEBP`, …) from the console.

## Notes on the design

- **The world has a fixed height and a variable width.** `resize()` derives the logical
  width from the device aspect (clamped to 1.30-2.40), so a 20:9 phone gets more court
  instead of black bars. A ResizeObserver plus a per-frame size check catch every case a
  window resize event misses - rotation, split screen, browser chrome.
- **All three modes are open from launch.** No score gates.
- **Input precision.** Balls hit-test as if they were larger (`BALL_BIAS`); bombs as if
  they were smaller (`BOMB_DEADZONE`); and if any ball is within `BALL_PRIORITY_PAD`,
  bombs are not considered at all. The same rule governs a press as a swipe, so an
  ambiguous touch always resolves to the ball. Touching a bomb never detonates it — a
  bomb only goes off if it falls out of the bottom or drops through the rim. The spawner
  also refuses to place a bomb within `BOMB_SAFE_DIST` of the ball carrying a combo.
- **The backboard collider is the raised left strike area of the supplied artwork.** In
  this three-quarter view the glass sits *behind* the rim. A collider covering the whole
  board sealed off the only lane a ball can fall through — nothing could score at all —
  and a collider level with the rim made right-side shots roughly a third as likely as
  left-side ones.
- **Style has to be earned on a rhythm.** A juggle only counts if it is at least
  `STYLE.MIN_GAP` after the last one and actually sends the ball upward by
  `STYLE.MIN_LIFT`. Without those two gates, mashing one ball farmed the multiplier.
- **Spring impulses are velocities, not pixels.** `NET_WHIP` and `RIM_FLEX` feed a spring,
  so the numbers look large; the net stretch they produce is about 40px and 12px. The
  original values moved the net by four pixels, which is why the dunk had no punch.
- **Variety beats repetition.** A new trick pays `VARIETY_BONUS` extra; the same trick
  repeated decays through `REPEAT_DECAY` to 15% of value.
