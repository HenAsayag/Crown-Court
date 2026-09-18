/* ==================================================================
   CROWN COURT - "Rule the rim."
   A swipe-to-dunk arcade high-score chaser.
   Canvas + vanilla JS, no framework, no backend.
   ------------------------------------------------------------------
   EVERY TUNABLE NUMBER LIVES IN `CONFIG`. Nothing below it hard-codes
   a balance value - change it here and the whole game moves.
   ================================================================== */
"use strict";

const CONFIG = {

  /* ---------- WORLD ------------------------------------------------
     Fixed 1280x720 logical space (16:9 landscape, played on its side).
     The canvas is scaled to the device, so every number here is
     resolution independent.                                        */
  WORLD: {
    H: 720,               // the reference height. Never changes.
    W: 1280,              // starting width; recomputed from the real screen
    ASPECT_MIN: 1.30,     // 4:3 tablets
    ASPECT_MAX: 2.40      // 21.5:9 phones. Beyond this the world stops widening.
  },

  /* ---------- PHYSICS ---------------------------------------------- */
  PHYSICS: {
    GRAVITY: 1150,          // quick rising toss, readable apex, decisive fall
    AIR_DRAG: 0.08,         // fraction of velocity bled per second
    MAGNUS: 10,             // spin -> sideways curve. This is what makes
                            // a curved swipe bend the shot.
    SPIN_DECAY: 0.85,       // spin bleed per second
    BALL_R: 46,             // outer iron is ~2.3 ball diameters
    BOMB_R: 38,
    CROWN_R: 42,
    WALL_BOUNCE: 0.55,      // energy kept off the side walls
    MAX_SPEED: 2400,        // hard ceiling, keeps tunnelling impossible
    REST_RIM: 0.52,         // bounciness off the rim lips
    REST_BOARD: 0.72,       // a crisp bank off the glass
    STEP_DISTANCE: 10,     // maximum travel per collision step, including held balls
    SOFT_RIM: 0.30,        // restitution while Soft Touch is charged
    SPAWN_SPIN: 2.0         // random spin a thrown ball starts with
  },

  /* ---------- SWIPE ------------------------------------------------
     The whole game is this gesture. Direction, speed and WHERE on the
     ball you hit it all matter.                                     */
  SWIPE: {
    HISTORY: 12,            // support high-refresh phones
    SAMPLE_WINDOW: 0.055,   // respond to the release direction after a curved swipe
    MIN_SPEED: 140,         // flick-through threshold. Low, so even a
                            // lazy slash still moves the ball.
    POWER: 0.85,            // flick speed -> imparted speed. Tuned so a
                            // normal flick lands mid-range and only a hard
                            // one reaches the ceiling - speed has to matter.
    MAX_IMPULSE: 2100,
    LIFT: 0.04,             // subtle lift without fighting downward dunks
    OFFSET_SPIN: 0.105,     // hitting off-centre -> spin. Was 0.02, which
                            //  capped real spin at ~4 and made CORKSCREW (9)
                            //  and the spin style bonus literally unreachable.
    CURVE_SPIN: 7.0,        // a curved swipe path -> extra spin
    MAX_SPIN: 22,
    COOLDOWN: 0.09,         // per-object re-hit lockout

    /* --- input precision (the original's worst bug, fixed here) --- */
    BALL_BIAS: 30,          // balls swipe as if they were this much bigger
    BOMB_DEADZONE: 12,      // bombs swipe as if they were this much smaller
    BALL_PRIORITY_PAD: 34,  // a ball this close wins outright - the bomb
                            // in the same place is simply not considered
    /* --- trick gestures --- */
    WINDMILL_TURN: 5.4,     // radians of accumulated turn before release
    CORKSCREW_SPIN: 8,      // |spin| at the moment of scoring

    /* --- grab & drag: press on a ball and it follows your finger --- */
    GRAB_RADIUS: 26,        // extra reach when you PRESS on something
    GRAB_MAX_TIME: 1.8,     // enough time for a deliberate sweeping dunk
    RELEASE_POWER: 0.85,    // same response for a flick and a held release
    RELEASE_MIN: 120        // let go slower than this and it simply drops
  },

  /* ---------- HOOP -------------------------------------------------
     The rim rectangle is expressed as fractions of the hoop sprite so
     the art and the collision box can never drift apart.            */
  HOOP: {
    SPRITE_W: 690, SOURCE_W: 1448, SOURCE_H: 1086,
    RIM: { cx: 943 / 1448, cy: 658 / 1086, rx: 205 / 1448, ry: 37 / 1086 },
    // The raised board face is left of the opening in this projected view.
    // Its lower painted portion is behind the rim, not a wall across the scoring lane.
    BOARD: { x: .305, y: .19, w: .23, h: .27 },
    X_FROM_LEFT: 280,
    Y: 510,
    NET_LENGTH: 153,
    LIP_R: 9,               // radius of the two rim-lip colliders
    FLEX_SPRING: 230, FLEX_DAMP: 26,   // stiff + well damped: it snaps once
    NET_SPRING: 105, NET_DAMP: 9.5,   // the net swings, then settles inside a second
    SWAY: 0,                // 0 = the hoop holds still. Raise it to add drift.
    SWAY_SPEED: 0.30        // ...and how fast (0 = a fixed hoop)
  },

  /* ---------- SPAWNER ---------------------------------------------- */
  SPAWN: {
    FIRST_DELAY: 0.85,
    INTERVAL: 1.08,         // seconds between throws at difficulty 0
    INTERVAL_MIN: 0.54,     // enough room to read and catch each toss
    RAMP_SECONDS: 60,       // how long the ramp takes to top out
    RIGHT_MIN: .73, RIGHT_MAX: .94,
    APEX_MIN: 145, APEX_MAX: 280,
    VX_MIN: -210, VX_MAX: -95,
    EDGE_PAD: 150,
    HOOP_CLEARANCE: 440,    // never launch from underneath the hoop          // keeps throws away from the very edges
    BOMB_RATIO: 0.10,       // chance a throw is a bomb, at difficulty 0
    BOMB_RATIO_MAX: 0.32,
    BOMB_SAFE_DIST: 230,    // a bomb is never thrown this close to a
                            // ball that is currently carrying the combo
    DOUBLE_CHANCE: 0.22,    // chance of a two-ball throw
    DOUBLE_GAP: 0.20,
    MAX_LIVE: 8             // hard cap on objects on screen
  },

  /* ---------- COMBO ------------------------------------------------ */
  COMBO: {
    WINDOW: 4.2,            // seconds on the decay bar at combo 1
    WINDOW_MIN: 2.4,        // the bar gets meaner as the chain grows
    WINDOW_STEP: 0.11,      // seconds knocked off per combo step
    MULT_STEP: 3,           // dunks needed per +1 multiplier
    MULT_CAP: 9,            // Sudden Death ignores this cap
    VARIETY_BONUS: 0.40,    // a NEW trick pays this much extra
    REPEAT_DECAY: [1, 0.55, 0.30, 0.15]  // spamming one trick dies off fast
  },

  /* ---------- SCORING ---------------------------------------------- */
  SCORE: {
    DUNK: 100,              // base value of any dunk
    CROWN_PICKUP: 260,      // an OVERTIME crown put through the net
    BOMB_IN_HOOP: -400,     // a bomb dunked: it costs you
    RANK_MULT_PER_LEVEL: 0.01   // permanent +1% score per rank
  },

  /* ---------- CROWNS (the currency) -------------------------------- */
  CROWNS: {
    PER_POINTS: 260,        // 1 crown per this many points scored
    PER_TRICK: 1,           // plus one per trick pulled off
    BRONZE: 4, SILVER: 9, GOLD: 16,   // OVERTIME pickups
    RANK_UP: 70             // handed out on every rank up
  },

  /* ---------- RANKS ------------------------------------------------- */
  RANK: {
    XP_PER_POINT: 1,
    BASE: 2400,             // xp needed for rank 2
    GROWTH: 1.26,           // each rank costs this much more
    NAMES: ["Rookie","Streetballer","Sixth Man","Starter","Sharpshooter",
            "Highlight","Showman","All-Star","Franchise","Legend",
            "Immortal","Crowned"]
  },

  /* ---------- MODES ------------------------------------------------- */
  MODES: {
    time:   { seconds: 60, lives: 0, ramp: 1.00, overtime: true,  multCap: true,  bombSeconds: 2 },
    arcade: { seconds: 0,  lives: 3, ramp: 1.40, overtime: false, multCap: true  },
    sudden: { seconds: 0,  lives: 1, ramp: 1.10, overtime: false, multCap: false }
  },
  OVERTIME: {
    TRIGGER_COMBO: 7,       // get this hot in Time Attack and it kicks in
    DURATION: 12,
    INTERVAL_MULT: 0.72,    // crowns come faster than balls did
    TIME_BONUS: 0           // set >0 to also add seconds to the clock
  },

  /* ---------- HELPERS ----------------------------------------------
     Meter maths: PER_DUNK 13 means ~8 dunks per charge, and a decent
     60s Time Attack run is 25-35 dunks - so 3 to 4 uses per run.   */
  HELPER: {
    METER_MAX: 100,
    PER_DUNK: 12,
    PER_TRICK: 2,
    PER_BOMB_CLEARED: 3
  },

  /* ---------- JUICE -------------------------------------------------- */
  JUICE: {
    SHAKE_DUNK: 7, SHAKE_TRICK: 12, SHAKE_BOMB: 22, SHAKE_CLANK: 4,
    SHAKE_DECAY: 5.2,
    SLOWMO_SCALE: 0.28,     // timescale for the final shot of a run
    SLOWMO_TIME: 0.55,
    TRAIL_MIN_SPEED: 700,   // swipe faster than this and the ball streaks
    TRAIL_LEN: 14,
    PARTICLE_CAP: 280,
    BURST_ON_DUNK: 1,
    POP_RISE: 58, POP_TIME: 1.10,
    HAPTIC_DUNK: 16, HAPTIC_TRICK: [12, 26, 14], HAPTIC_BOMB: 90,
    RIM_FLEX: 170,          // impulse into the rim spring on contact (not px:
                            //  the spring turns it into roughly a 12px dip)
    NET_WHIP: 640,          // impulse into the net spring on a make, which
                            //  works out at roughly 58px of stretch
    SCORE_PULSE: 0.42,      // seconds of rim flash + shockwave ring
    BALL_DROP_TIME: 0.60,   // enough time to visibly exit below the net
    FLASH_DUNK: 0.10, FLASH_TRICK: 0.2, FLASH_BOMB: 0.5
  },

  /* ---------- SHOT ASSIST -------------------------------------------
     A throw that is roughly on line gets gently steered home. This is
     what makes the original feel generous: you aim, and near misses
     become makes. Set STRENGTH to 0 for pure, unassisted physics.   */
  ASSIST: {
    STRENGTH: 0,            // ballistic throws: release speed determines the shot
    MAX_ANGLE: 0.70,        // radians of aim error it will still correct (40 deg)
    MIN_SPEED: 650,         // only real throws, not taps
    RANGE: 1000,            // only once the ball is within this of the rim
    STOP_DIST: 70           // stop steering this close, so it drops naturally
  },

  /* ---------- SKILLS ------------------------------------------------
     Keep a ball alive in the air - flick it up again, load it with spin,
     juggle it - and it builds STYLE. Style multiplies the whole dunk, so
     a worked ball is worth several plain ones.                        */
  STYLE: {
    PER_JUGGLE: 1.0,        // every touch after the first
    SPIN_BONUS: 0.9,        // ...worth more if that touch loaded real spin
    SPIN_MIN: 8,            // |spin| that counts as spinning it
    HIGH_BONUS: 0.6,        // ...and more again if you popped it up high
    HIGH_Y: 0.42,           // high = above this fraction of the screen
    AIR_PER_SEC: 0.65,      // reward for keeping it up once the run starts
    MIN_GAP: 0.35,          // a juggle has to have rhythm - touches closer
                            //  together than this earn nothing, so mashing
                            //  the same ball cannot farm style
    MIN_LIFT: 220,          // ...and the touch has to actually send it UP
    PER_LEVEL: 2.0,         // style points per level
    MAX_LEVEL: 5,
    MULT_PER_LEVEL: 0.5,    // x1 -> x3.5 at level 5
    NAMES: ['', 'NICE', 'SLICK', 'FANCY', 'SHOWTIME', 'UNREAL'],
    COLOURS: ['#fff4e0', '#8ef5a0', '#7ee8fa', '#ffd23f', '#ff9b2f', '#ff2fd0']
  },

  AUDIO: { MASTER: 0.5, SFX: 0.85, CROWD: 0.5 },

  /* ---------- PERSONALISATION ---------------------------------------- */
  PLAYER: { NAME: "HEN", NUMBER: "10", JERSEY: "red" },
  GAME_NAME: "CROWN COURT",
  TAGLINE: "Rule the rim.",
  SAVE_KEY: "crowncourt.save.v1"
};

/* ==================================================================
   CONTENT TABLES
   ================================================================== */

/* ---- the 12 tricks ------------------------------------------------
   `test` runs at the moment a ball drops through the rim. Every trick
   that passes is awarded; the most valuable one gets the callout.
   `teach` is the card shown when a rank up introduces it.          */
const TRICKS = [
  { id:"swish",    name:"SWISH",        pts:60,  colour:"#8ef5a0",
    teach:"Straight through the middle without touching iron. The cleanest points in the game.",
    test:(s)=> s.hitRim===0 && s.hitBoard===0 },
  { id:"bank",     name:"BANK SHOT",    pts:70,  colour:"#ffd23f",
    teach:"Kiss the backboard on the way in. Aim past the rim and let the glass do the work.",
    test:(s)=> s.hitBoard>0 && s.hitRim===0 },
  { id:"rebound",  name:"REBOUND",      pts:90,  colour:"#ff9b2f",
    teach:"Miss, then punish it. Swipe a ball that has already bounced off the iron back through the net.",
    test:(s)=> s.surfaces>=2 },
  { id:"windmill", name:"WINDMILL",     pts:150, colour:"#ff5fa2",
    teach:"Draw a full circle around the ball with your finger before you let go. Big swing, big points.",
    test:(s)=> s.windmill },
  { id:"corkscrew",name:"CORKSCREW",    pts:120, colour:"#7ee8fa",
    teach:"Swipe across the edge of the ball to load it with spin. It curves in the air - and scores extra.",
    test:(s)=> Math.abs(s.spin) >= CONFIG.SWIPE.CORKSCREW_SPIN },
  { id:"glass",    name:"OFF THE GLASS",pts:130, colour:"#ffe38a",
    teach:"A bank shot while your combo is already alive. Keep using the glass and it keeps paying.",
    test:(s)=> s.hitBoard>0 && s.comboBefore>=2 },
  { id:"alley",    name:"ALLEY-OOP",    pts:180, colour:"#b98cff",
    teach:"Swipe one ball into another in mid-air. The ball that gets hit and goes in is the alley-oop.",
    test:(s)=> s.alleyOop },
  { id:"longbomb", name:"LONG BOMB",    pts:140, colour:"#ff7043",
    teach:"Launch it from the very bottom of the screen. The further out you start, the more it pays.",
    test:(s)=> s.launchY >= CONFIG.WORLD.H * 0.80 },
  { id:"nolook",   name:"NO-LOOK",      pts:110, colour:"#9ad5ff",
    teach:"Score while another ball is still in the air. Two things at once, eyes on one of them.",
    test:(s)=> s.othersAirborne>=1 },
  { id:"buzzer",   name:"BUZZER BEATER",pts:220, colour:"#ff3b5c",
    teach:"Put one through in the last three seconds. The clock makes it worth double the drama.",
    test:(s)=> s.buzzer },
  { id:"double",   name:"DOUBLE DUNK",  pts:200, colour:"#ffd700",
    teach:"Two balls through the net within half a second of each other. Set them up, then knock them down.",
    test:(s)=> s.sinceLastDunk <= 0.5 && s.comboBefore>=1 },
  { id:"chain",    name:"CHAIN FINISH", pts:260, colour:"#ff2fd0",
    teach:"Land a dunk with a combo of eight or more. The longer the chain, the bigger the finish.",
    test:(s)=> s.comboBefore>=8 }
];
const TRICK_BY_ID = Object.fromEntries(TRICKS.map(t=>[t.id,t]));

/* ---- companions --------------------------------------------------- */
const HELPERS = [
  { id:"chill",  name:"Chill",    price:0,   icon:"trailSmoke", colour:"#9ad5ff",
    ability:"slow",   dur:6,
    blurb:"Slows the whole court to a crawl for 6s.",
    long:"Everything moves at a third speed. Your swipes do not." },
  { id:"magnet", name:"Magnet",   price:220, icon:"swoosh",     colour:"#ff5fa2",
    ability:"magnet", dur:8,
    blurb:"Balls curve toward the rim for 8s.",
    long:"Every ball you swipe bends toward the hoop. Near misses become makes." },
  { id:"double", name:"Doubler",  price:260, icon:"sparkle",    colour:"#ffd23f",
    ability:"double", dur:10,
    blurb:"Everything scores double for 10s.",
    long:"Stack it on a hot combo and the numbers get silly." },
  { id:"sweep",  name:"Sweeper",  price:300, icon:"burst",      colour:"#ff7043",
    ability:"sweep",  dur:3,
    blurb:"Clears every bomb instantly.",
    long:"Wipes the screen of bombs and keeps the court clean for 3s." },
  { id:"wide",   name:"Soft Touch", price:340, icon:"hoop", colour:"#8ef5a0",
    ability:"soft", dur:10,
    blurb:"Softer rim rebounds for 10s.",
    long:"Takes the sting out of rim hits. Same hoop, a softer bounce." }
];

/* ---- balls: a paint job and a small, honest physics twist --------- */
const BALLS = [
  { id:"classic", name:"Classic", price:0, art:"classic", sprite:"ball-classic", trail:"trailWarm",
    grav:1.00, size:1.00, power:1.00, crowns:1.00, blurb:"Standard leather. No tricks." },
  { id:"gold",    name:"Royal",   price:280, art:"royal", sprite:"ball-gold",    trail:"trailWarm",
    grav:1.07, size:1.00, power:1.00, crowns:1.15, blurb:"Heavier, but pays 15% more crowns." },
  { id:"frost",   name:"Crystal", price:240, art:"crystal", sprite:"ball-frost",   trail:"trailSmoke",
    grav:0.90, size:1.00, power:1.00, crowns:1.00, blurb:"Floats. More hang time to work with." },
  { id:"void",    name:"Neon",    price:320, art:"neon", sprite:"ball-void",    trail:"trailRed",
    grav:1.00, size:0.94, power:1.10, crowns:1.00, blurb:"Small and fast. Swipes hit harder." },
  { id:"lime",    name:"Graffiti",price:200, art:"graffiti", sprite:"ball-lime",    trail:"trailWarm",
    grav:1.02, size:1.10, power:0.96, crowns:1.00, blurb:"Oversized. Much easier to catch." }
];

/* ---- courts: grades of the same beachfront ----------------------- */
const COURTS = [
  { id:"sunset", name:"Street Court", price:0, img:"courtSunset", panel:0, tint:"rgba(5,29,43,0.13)",
    blurb:"Under the bridge. Above the competition." },
  { id:"night", name:"King Court", price:260, img:"courtNight", panel:1, tint:"rgba(43,18,20,0.12)",
    blurb:"Every king needs a home court." },
  { id:"noon", name:"Carnival", price:300, img:"courtNoon", panel:2, tint:"rgba(26,12,50,0.12)",
    blurb:"Bright lights. Big-time highlights." }
];

/* ---- asset manifest ---------------------------------------------- */
const ASSETS = {
  courtsAtlas: "assets/atlas/courts.png",
  hoop:        "assets/obj/street-hoop.png",
  ball:        "assets/obj/ball.webp",
  "ball-classic": "assets/obj/ball-classic.webp",
  "ball-gold":    "assets/obj/ball-gold.webp",
  "ball-frost":   "assets/obj/ball-frost.webp",
  "ball-void":    "assets/obj/ball-void.webp",
  "ball-lime":    "assets/obj/ball-lime.webp",
  crown:       "assets/obj/crown.webp",
  crownGold:   "assets/obj/crown-gold.webp",
  crownSilver: "assets/obj/crown-silver.webp",
  crownBronze: "assets/obj/crown-bronze.webp",
  trailWarm:   "assets/obj/trail-warm.webp",
  trailRed:    "assets/obj/trail-red.webp",
  trailSmoke:  "assets/obj/trail-smoke.webp",
  burst:       "assets/obj/burst.webp",
  sparkle:     "assets/obj/sparkle.webp",
  swoosh:      "assets/obj/swoosh.webp",
  courtSunset: "assets/court/sunset.webp",
  courtNight:  "assets/court/night.webp",
  courtNoon:   "assets/court/noon.webp",
  pCelebrate:  "assets/player/celebrate.webp",
  pDejected:   "assets/player/dejected.webp",
  pDunk:       "assets/player/dunk.webp",
  pIdle:       "assets/player/idle.webp",
  coin:        "assets/ui/coin.webp",
  crest:       "assets/ui/crest.webp"
};

/* ==================================================================
   1. UTILITIES
   ================================================================== */
/* H is fixed; W is recomputed in resize() from the device's real aspect so the
   canvas fills the screen edge to edge instead of being letterboxed. */
let W = CONFIG.WORLD.W;
const H = CONFIG.WORLD.H;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[(Math.random() * a.length) | 0];
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const sign = v => v < 0 ? -1 : 1;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString("en-US");
const FONT = '"Arial Rounded MT Bold","Nunito",ui-rounded,system-ui,sans-serif';

/* "#rrggbb" + alpha -> rgba(), used by the style aura and court tints */
function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const v = parseInt(full, 16) || 0;
  return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
}

/* shortest signed angle between two headings */
function angDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
/* distance from point p to segment ab, plus where along it that happened */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / L;
  t = clamp(t, 0, 1);
  const qx = ax + dx * t, qy = ay + dy * t;
  return { d: Math.hypot(px - qx, py - qy), t, x: qx, y: qy };
}

/* ==================================================================
   2. SAVE DATA
   ================================================================== */
const DEFAULT_SAVE = {
  name: CONFIG.PLAYER.NAME,
  crowns: 0,
  muted: false,
  xp: 0,
  rank: 1,
  taught: [],                    // trick ids already introduced by a card
  best: { time: 0, arcade: 0, sudden: 0 },
  scores: [],
  ball: "classic", court: "sunset", helper: "chill",
  ownedBalls: ["classic"], ownedCourts: ["sunset"], ownedHelpers: ["chill"],
  stats: { runs: 0, dunks: 0, tricks: 0, bombs: 0, bestCombo: 0, crownsEarned: 0, overtimes: 0 }
};
let SAVE = loadSave();

function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const p = JSON.parse(raw), s = structuredClone(DEFAULT_SAVE);
    for (const k in p) {
      if (k === "stats" || k === "best") Object.assign(s[k], p[k]);
      else s[k] = p[k];
    }
    return s;
  } catch (e) { return structuredClone(DEFAULT_SAVE); }
}
let saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 250); }
function saveNow() {
  clearTimeout(saveT);
  try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {}
}

/* rank maths */
function xpForRank(r) {
  // total xp needed to REACH rank r
  let total = 0, step = CONFIG.RANK.BASE;
  for (let i = 1; i < r; i++) { total += step; step *= CONFIG.RANK.GROWTH; }
  return Math.round(total);
}
function rankName(r) {
  const N = CONFIG.RANK.NAMES;
  return N[Math.min(r - 1, N.length - 1)];
}
const rankMult = () => 1 + (SAVE.rank - 1) * CONFIG.SCORE.RANK_MULT_PER_LEVEL;

/* ==================================================================
   3. AUDIO - every sound synthesised, no audio files
   ================================================================== */
const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null, ready = false, crowdGain = null;

  function init() {
    if (ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = SAVE.muted ? 0 : CONFIG.AUDIO.MASTER;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // a permanent low murmur of crowd, swelled on big moments
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 480; f.Q.value = .7;
    src.connect(f).connect(crowdGain).connect(master); src.start();
    ready = true;
  }
  const now = () => ctx.currentTime;
  function tone(freq, dur, type, vol, slide, delay) {
    if (!ready) return;
    const t = now() + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((vol || .3) * CONFIG.AUDIO.SFX, t + .012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function noise(dur, vol, type, f0, f1, q, delay) {
    if (!ready) return;
    const t = now() + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || "bandpass";
    f.frequency.setValueAtTime(Math.max(40, f0), t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((vol || .3) * CONFIG.AUDIO.SFX, t + .015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + .05);
  }
  return {
    init, resume() { if (ctx && ctx.state === "suspended") ctx.resume(); },
    setMuted(m) { if (master) master.gain.value = m ? 0 : CONFIG.AUDIO.MASTER; },
    /* net, no iron */
    swish() { noise(.3, .40, "bandpass", 5600, 1000, 1.3); tone(920, .1, "sine", .09, 1400); },
    /* iron */
    clank() { tone(1240, .2, "square", .15, 480); tone(1820, .12, "triangle", .09, 900); noise(.08, .14, "highpass", 2800, 1900, .8); },
    board() { tone(250, .16, "triangle", .18, 150); noise(.07, .11, "lowpass", 900, 400, .7); },
    whoosh(p) { noise(.18, .12 + .12 * p, "bandpass", 500 + 1100 * p, 2600, .9); },
    bomb() {
      noise(.7, .55, "lowpass", 900, 60, .9);
      tone(110, .6, "sawtooth", .35, 32);
      noise(.3, .3, "highpass", 3000, 800, .7);
    },
    fuse() { noise(.14, .05, "highpass", 4200, 3000, .6); },
    coin() { tone(1400, .08, "square", .12, 1900); tone(2100, .09, "square", .08, 2800, .05); },
    crown() {[0,.06,.13].forEach((d,i)=>tone([1046,1318,1568][i], .22, "triangle", .17, null, d)); },
    cheer(strength) {
      if (!ready) return;
      const t = now(), s = clamp(strength || 1, 0, 2);
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
      crowdGain.gain.linearRampToValueAtTime(CONFIG.AUDIO.CROWD * .35 * s, t + .07);
      crowdGain.gain.exponentialRampToValueAtTime(0.0008, t + .9 + .5 * s);
      noise(.5 + .3 * s, CONFIG.AUDIO.CROWD * .2 * s, "bandpass", 800, 1800, .5);
    },
    ambience(on) {
      if (!ready) return;
      const t = now();
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.linearRampToValueAtTime(on ? CONFIG.AUDIO.CROWD * .05 : 0, t + .6);
    },
    trick() {[0,.07,.15,.24].forEach((d,i)=>tone([660,880,1100,1470][i], .2, "triangle", .16, null, d)); },
    rankUp() {[0,.1,.2,.32,.46].forEach((d,i)=>tone([523,659,784,1046,1318][i], .3, "triangle", .2, null, d));
              noise(.9, .16, "bandpass", 700, 2200, .6, .05); },
    ability() { tone(200, .45, "sawtooth", .2, 900); noise(.5, .18, "bandpass", 500, 3000, .8); },
    fail() { tone(320, .38, "sawtooth", .16, 90); noise(.28, .1, "lowpass", 700, 200, .7); },
    click() { tone(820, .045, "square", .09, 560); },
    buy() { tone(880, .1, "triangle", .16, 1320); tone(1320, .13, "triangle", .12, 1760, .07); }
  };
})();
function haptic(p) {
  if (SAVE.muted) return;
  if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} }
}

/* ==================================================================
   4. ASSET LOADING
   ================================================================== */
const IMG = {};
let loadedCount = 0;
function loadAssets(onProgress) {
  const keys = Object.keys(ASSETS);
  return Promise.all(keys.map(k => new Promise(res => {
    const i = new Image();
    i.onload = i.onerror = () => { IMG[k] = i; loadedCount++; onProgress(loadedCount / keys.length); res(); };
    i.src = ASSETS[k];
  })));
}

/* ==================================================================
   5. FX: shake, particles, floating text, flash
   ================================================================== */
const Shake = {
  amt: 0, x: 0, y: 0,
  add(v) { this.amt = Math.min(this.amt + v, 40); },
  update(dt) {
    this.amt = Math.max(0, this.amt - CONFIG.JUICE.SHAKE_DECAY * this.amt * dt - 8 * dt);
    this.x = rand(-this.amt, this.amt);
    this.y = rand(-this.amt, this.amt);
  }
};

const P = [];
function spawnP(o) {
  if (P.length >= CONFIG.JUICE.PARTICLE_CAP) P.shift();
  P.push({
    x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, r: o.r || 4, life: o.life || .6, t: 0,
    c: o.c || "#fff", g: o.g === undefined ? 900 : o.g, shape: o.shape || "dot",
    rot: o.rot || 0, vr: o.vr || 0, img: o.img || null, drag: o.drag || 0, spin: o.spin || 0
  });
}
function burst(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const a = o.dir === undefined ? rand(0, TAU) : o.dir + rand(-o.spread, o.spread);
    const sp = rand(o.spMin || 120, o.spMax || 480);
    spawnP({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: rand(o.rMin || 3, o.rMax || 8), life: rand(o.lifeMin || .35, o.lifeMax || .85),
      c: Array.isArray(o.c) ? pick(o.c) : o.c, g: o.g, shape: o.shape, vr: rand(-12, 12), drag: o.drag
    });
  }
}
/* a one-shot sprite that scales up and fades - used for the burst art */
function spriteFx(img, x, y, size, life, rot, spin) {
  spawnP({ x, y, r: size, life: life || .45, img, rot: rot || 0, g: 0, shape: "sprite", spin: spin || 0 });
}
function updateP(dt) {
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.t += dt;
    if (p.t >= p.life) { P.splice(i, 1); continue; }
    p.vy += p.g * dt;
    if (p.drag) { const k = 1 - p.drag * dt; p.vx *= k; p.vy *= k; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += (p.vr + p.spin) * dt;
  }
}
function drawP(g) {
  for (let i = 0; i < P.length; i++) {
    const p = P[i], k = 1 - p.t / p.life;
    if (p.shape === "sprite" && p.img) {
      const s = p.r * (0.55 + (1 - k) * 0.85);
      g.save();
      g.globalAlpha = Math.min(1, k * 1.6);
      g.globalCompositeOperation = "lighter";
      g.translate(p.x, p.y); g.rotate(p.rot);
      g.drawImage(p.img, -s / 2, -s / 2, s, s);
      g.restore();
      continue;
    }
    g.globalAlpha = k;
    g.fillStyle = p.c;
    if (p.shape === "rect") {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillRect(-p.r, -p.r * .5, p.r * 2, p.r); g.restore();
    } else if (p.shape === "spark") {
      g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx));
      g.fillRect(0, -p.r * .3, p.r * 3.4 * k, p.r * .6); g.restore();
    } else {
      g.beginPath(); g.arc(p.x, p.y, p.r * k, 0, TAU); g.fill();
    }
  }
  g.globalAlpha = 1;
}

/* floating score / trick callouts */
const POPS = [];
function pop(x, y, text, colour, size) {
  POPS.push({ x, y, text, c: colour || "#fff", t: 0, life: CONFIG.JUICE.POP_TIME, size: size || 30 });
}
function updatePops(dt) {
  for (let i = POPS.length - 1; i >= 0; i--) {
    POPS[i].t += dt;
    if (POPS[i].t >= POPS[i].life) POPS.splice(i, 1);
  }
}
function drawPops(g) {
  g.textAlign = "center"; g.textBaseline = "middle";
  for (const p of POPS) {
    const k = p.t / p.life;
    const y = p.y - CONFIG.JUICE.POP_RISE * easeOutCubic(k);
    const s = k < .15 ? easeOutBack(k / .15) : 1;
    g.save();
    g.globalAlpha = k > .68 ? 1 - (k - .68) / .32 : 1;
    g.translate(p.x, y); g.scale(s, s);
    g.font = "900 " + p.size + "px " + FONT;
    g.lineWidth = 7; g.strokeStyle = "rgba(40,4,12,.85)"; g.lineJoin = "round";
    g.strokeText(p.text, 0, 0);
    g.fillStyle = p.c; g.fillText(p.text, 0, 0);
    g.restore();
  }
}

let flashT = 0;
const flashEl = () => $("flash");
function flash(a) { flashT = Math.max(flashT, a); }
function updateFlash(dt) {
  const el = flashEl();
  if (flashT > 0) { flashT = Math.max(0, flashT - dt * 2.6); el.style.opacity = flashT; }
  else if (el.style.opacity !== "0") el.style.opacity = "0";
}

/* ==================================================================
   6. GAME STATE
   ================================================================== */
const ST = { LOAD:"load", MENU:"menu", PLAY:"play", PAUSED:"paused", OVER:"over" };

const G = {
  state: ST.LOAD,
  mode: "time",
  score: 0, dunks: 0, tricks: 0, crownsRun: 0,
  combo: 0, mult: 1, comboT: 0, comboMax: 0, bestCombo: 0,
  lastTrickId: null, repeatRun: 0,
  lives: 0, maxLives: 0,
  timeLeft: 0, elapsed: 0,
  difficulty: 0,
  spawnT: 0,
  lastDunkAt: -99,
  overtime: false, overtimeT: 0, overtimesThisRun: 0,
  timeScale: 1, slowT: 0, slowUsed: false,
  helperMeter: 0, helperActive: null, helperT: 0, helperUses: 0,
  trickCounts: {},
  newBest: false,
  ended: false
};

const objs = [];          // every ball, bomb and crown on the court
let objId = 1;

const hoopBaseX = () => CONFIG.HOOP.X_FROM_LEFT;
const hoop = {
  x: CONFIG.HOOP.X_FROM_LEFT, y: CONFIG.HOOP.Y,
  swayT: 0,
  flex: 0, flexV: 0,      // vertical give when the rim is struck
  net: 0, netV: 0,        // net whip
  pulse: 0,               // rim flash + shockwave after a make
  wide: 1                 // rim multiplier while Wideboy is running
};
const spriteH = () => CONFIG.HOOP.SPRITE_W * CONFIG.HOOP.SOURCE_H / CONFIG.HOOP.SOURCE_W;
const rimRX = () => CONFIG.HOOP.RIM.rx * CONFIG.HOOP.SPRITE_W;
const rimRY = () => CONFIG.HOOP.RIM.ry * spriteH();
/* The backboard is nailed to the wall: this origin never moves. */
const hoopOrigin = () => ({
  x: hoop.x - CONFIG.HOOP.RIM.cx * CONFIG.HOOP.SPRITE_W,
  y: hoop.y - CONFIG.HOOP.RIM.cy * spriteH()
});
/* Only the rim and net ride the flex spring. */
const hoopOriginFlexed = () => {
  const o = hoopOrigin();
  return { x: o.x, y: o.y + hoop.flex };
};
function boardRect() {
  const C=CONFIG.HOOP, b=C.BOARD, origin=hoopOrigin(), height=spriteH();
  return {x:origin.x+b.x*C.SPRITE_W,y:origin.y+b.y*height,w:b.w*C.SPRITE_W,h:b.h*height};
}

const equippedBall = () => BALLS.find(b => b.id === SAVE.ball) || BALLS[0];
const equippedCourt = () => COURTS.find(c => c.id === SAVE.court) || COURTS[0];
const equippedHelper = () => HELPERS.find(h => h.id === SAVE.helper) || HELPERS[0];

/* ==================================================================
   7. SPAWNING
   Difficulty walks from 0 to 1 over RAMP_SECONDS * mode.ramp.
   ================================================================== */
function spawnInterval() {
  const S = CONFIG.SPAWN;
  let iv = lerp(S.INTERVAL, S.INTERVAL_MIN, G.difficulty);
  if (G.overtime) iv *= CONFIG.OVERTIME.INTERVAL_MULT;
  return iv;
}
function bombChance() {
  const S = CONFIG.SPAWN;
  if (G.overtime) return 0;                       // OVERTIME is pure reward
  return lerp(S.BOMB_RATIO, S.BOMB_RATIO_MAX, G.difficulty);
}

/* a bomb must never land on top of the ball currently carrying the combo */
function bombSpotIsSafe(x) {
  if (G.combo === 0) return true;
  for (const o of objs) {
    if (o.kind !== "ball" || !o.alive) continue;
    if (!o.comboCarrier) continue;
    if (Math.abs(o.x - x) < CONFIG.SPAWN.BOMB_SAFE_DIST) return false;
  }
  return true;
}

function throwObject(forceKind) {
  const S = CONFIG.SPAWN;
  if (objs.filter(o => o.alive).length >= S.MAX_LIVE) return;

  let kind = forceKind || (Math.random() < bombChance() ? "bomb" : "ball");
  if (G.overtime && !forceKind) kind = "crown";

  const minX=Math.max(hoop.x+rimRX()+180,W*S.RIGHT_MIN);
  const maxX=Math.min(W-80,W*S.RIGHT_MAX);
  let x = rand(minX, maxX);
  if (kind === "bomb") {
    // try a few spots before giving up and throwing a ball instead
    let tries = 0;
    while (!bombSpotIsSafe(x) && tries < 6) { x = rand(minX,maxX); tries++; }
    if (!bombSpotIsSafe(x)) kind = "ball";
  }

  // Rising tosses from the lower right. They stay in the catching lane until the player swipes.
  const grav=kind==='ball'?equippedBall().grav:kind==='crown'?.82:1;
  const vy=-Math.sqrt(2*CONFIG.PHYSICS.GRAVITY*grav*(H+60-rand(S.APEX_MIN,S.APEX_MAX)));
  const vx=rand(S.VX_MIN,S.VX_MAX);
  const o = makeObject(kind, x, H + 60, vx, vy);
  objs.push(o);
  Sound.whoosh(clamp(Math.abs(vy) / 1400, .2, 1));
  return o;
}

function makeObject(kind, x, y, vx, vy) {
  const PH = CONFIG.PHYSICS, bm = equippedBall();
  const base = {
    id: objId++, kind, x, y, vx, vy, alive: true, rot: rand(0, TAU),
    spin: rand(-PH.SPAWN_SPIN, PH.SPAWN_SPIN), age: 0,
    hitCool: 0, trail: [], trailT: 0,
    held: false, heldOffX: 0, heldOffY: 0, manual: false
  };
  if (kind === "ball") {
    return Object.assign(base, {
      r: PH.BALL_R * bm.size, grav: bm.grav,
      hitRim: 0, hitBoard: 0, surfaces: 0,
      swiped: false, lastSwipeT: -99, lastSwipeY: y, windmill: false,
      alleyOop: false, comboCarrier: false, scored: false,
      style: 0, touches: 0, dying: 0, lastStyleT: -9, assist: false, squash: 0
    });
  }
  if (kind === "bomb") {
    return Object.assign(base, { r: PH.BOMB_R, grav: 1, fuse: 0, armed: true });
  }
  // crown
  const roll = Math.random();
  const tier = roll < .5 ? "bronze" : roll < .84 ? "silver" : "gold";
  return Object.assign(base, {
    r: PH.CROWN_R, grav: .82, tier,
    value: tier === "gold" ? CONFIG.CROWNS.GOLD : tier === "silver" ? CONFIG.CROWNS.SILVER : CONFIG.CROWNS.BRONZE
  });
}

/* ==================================================================
   8. PHYSICS
   ================================================================== */
function stepObjects(dt) {
  const PH = CONFIG.PHYSICS;
  const magnet = G.helperActive === "magnet";

  for (const o of objs) {
    if (!o.alive) continue;
    if (o.dying > 0) {                     // falling through the net
      o.dying -= dt;
      o.vy += PH.GRAVITY * .5 * dt;
      if(o.y < hoop.y + CONFIG.HOOP.NET_LENGTH) {
        o.vx += (hoop.x + (hoop.netSide || 0) - o.x) * 12 * dt;
        o.vx *= Math.max(0,1-6*dt);
      }
      o.y += o.vy * dt; o.x += o.vx * dt; o.rot += dt * 4;
      if (o.dying <= 0) o.alive = false;
      continue;
    }
    o.age += dt;
    o.hitCool = Math.max(0, o.hitCool - dt);

    const SUB = Math.max(1, Math.ceil(PH.MAX_SPEED * dt / PH.STEP_DISTANCE)), h = dt / SUB;
    for (let s = 0; s < SUB && !o.held; s++) {   // a held object follows the finger

      o.vy += PH.GRAVITY * (o.grav || 1) * h;
      o.vx += o.spin * PH.MAGNUS * h;              // spin curves the flight
      // shot assist: steer a well-aimed throw toward the rim
      if (o.assist && o.kind === "ball") {
        const A = CONFIG.ASSIST;
        const tx = hoop.x, ty = hoop.y - 40;
        const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
        if (d > A.STOP_DIST && d < A.RANGE) {
          const err = Math.abs(angDelta(Math.atan2(o.vy, o.vx), Math.atan2(dy, dx)));
          if (err < A.MAX_ANGLE) {
            const k = 1 - err / A.MAX_ANGLE;
            o.vx += (dx / d) * A.STRENGTH * k * h;
            o.vy += (dy / d) * A.STRENGTH * k * h;
          }
        }
      }
      if (magnet && o.kind !== "bomb" && o.vy > -200) {
        // Magnet: a gentle steering force toward the rim
        const dx = hoop.x - o.x, dy = (hoop.y - 90) - o.y;
        const d = Math.max(60, Math.hypot(dx, dy));
        o.vx += (dx / d) * 900 * h;
        o.vy += (dy / d) * 620 * h;
      }
      const k = 1 - PH.AIR_DRAG * h;
      o.vx *= k; o.vy *= k;
      o.spin *= 1 - PH.SPIN_DECAY * h;

      const sp = Math.hypot(o.vx, o.vy);
      if (sp > PH.MAX_SPEED) { const f = PH.MAX_SPEED / sp; o.vx *= f; o.vy *= f; }

      const px = o.x, py = o.y;
      o.x += o.vx * h;
      o.y += o.vy * h;
      o.rot += (o.vx * h) / o.r * 1.1 + o.spin * h * .35;

      collideEdges(o);
      collideHoop(o);
      if (o.alive) checkThroughRim(o, py, px);
      if (!o.alive || o.scored) break;
    }

    if (o.squash > 0) o.squash = Math.max(0, o.squash - dt * 4);

    // style also grows while a worked ball stays in the air
    if (o.kind === "ball" && o.style > 0 && !o.held) o.style += CONFIG.STYLE.AIR_PER_SEC * dt;

    // motion trail while it is moving fast
    o.trailT -= dt;
    if (o.trailT > 0) {
      o.trail.push({ x: o.x, y: o.y, r: o.r });
      if (o.trail.length > CONFIG.JUICE.TRAIL_LEN) o.trail.shift();
    } else if (o.trail.length) o.trail.shift();

    if (o.kind === "bomb") {
      o.fuse += dt;
      if (Math.random() < dt * 9) {
        spawnP({ x: o.x + rand(-6, 6), y: o.y - o.r * .78, vx: rand(-40, 40), vy: rand(-90, -30),
                 r: rand(2, 5), life: rand(.2, .45), c: pick(["#ffd23f","#ff7043","#fff"]), g: -60 });
      }
    }
    if (o.alive) checkOutOfPlay(o);
  }
  collideObjects(dt);
  for (let i = objs.length - 1; i >= 0; i--) if (!objs[i].alive) objs.splice(i, 1);
}

function collideEdges(o) {
  const PH = CONFIG.PHYSICS;
  if (o.kind === "bomb") return;        // bombs fly straight out of the sides
  if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) * PH.WALL_BOUNCE; o.spin *= -.5; }
  if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) * PH.WALL_BOUNCE; o.spin *= -.5; }
  if (o.y < -220) { o.y = -220; o.vy = Math.abs(o.vy) * .3; }   // soft ceiling well off-screen
}

/* the rim lips and the backboard */
function collideHoop(o) {
  const PH = CONFIG.PHYSICS, C = CONFIG.HOOP;
  const rx = rimRX(), ry = rimRY(), ry2 = hoop.y + hoop.flex;

  // --- two rim lips
  for (const s of [-1, 1]) {
    const lx = hoop.x + s * rx, ly = ry2;
    const dx = o.x - lx, dy = o.y - ly, d = Math.hypot(dx, dy), min = o.r + C.LIP_R;
    if (d < min && d > .0001) {
      const nx = dx / d, ny = dy / d;
      o.x = lx + nx * min; o.y = ly + ny * min;
      const vn = o.vx * nx + o.vy * ny;
      if (vn < 0) {
        const restitution = G.helperActive === "soft" ? PH.SOFT_RIM : PH.REST_RIM;
        o.vx -= (1 + restitution) * vn * nx;
        o.vy -= (1 + restitution) * vn * ny;
        if (o.kind === "ball") { o.hitRim++; o.surfaces++; o.assist = false; o.squash = 1; }
        hoop.flexV += clamp(-vn * .38, 0, CONFIG.JUICE.RIM_FLEX);  // visibly bends
        Sound.clank(); Shake.add(CONFIG.JUICE.SHAKE_CLANK); haptic(9);
        burst(lx, ly, 7, { c:["#ffd23f","#fff","#ff7043"], spMin:90, spMax:320, rMin:2, rMax:5,
                           lifeMin:.16, lifeMax:.4, g:700, shape:"spark" });
      }
    }
  }

  // --- backboard
  const b = boardRect();
  const cx = clamp(o.x, b.x, b.x + b.w), cy = clamp(o.y, b.y, b.y + b.h);
  const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
  if (d2 < o.r * o.r) {
    let nx, ny;
    if (d2 > .0001) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; o.x = cx + nx * o.r; o.y = cy + ny * o.r; }
    else {
      const l = o.x - b.x, r2 = b.x + b.w - o.x, t = o.y - b.y, bo = b.y + b.h - o.y;
      const m = Math.min(l, r2, t, bo);
      if (m === l) { nx = -1; ny = 0; o.x = b.x - o.r; }
      else if (m === r2) { nx = 1; ny = 0; o.x = b.x + b.w + o.r; }
      else if (m === t) { nx = 0; ny = -1; o.y = b.y - o.r; }
      else { nx = 0; ny = 1; o.y = b.y + b.h + o.r; }
    }
    const vn = o.vx * nx + o.vy * ny;
    if (vn < 0) {
      o.vx -= (1 + PH.REST_BOARD) * vn * nx;
      o.vy -= (1 + PH.REST_BOARD) * vn * ny;
      if (o.kind === "ball") { o.hitBoard++; o.surfaces++; o.assist = false; o.squash = 1; }
      hoop.boardPulse = .22;
      Sound.board(); Shake.add(2.5); haptic(8);
      burst(o.x, o.y, 6, { c:["#fff","#ffd23f"], spMin:60, spMax:220, rMin:2, rMax:4,
                           lifeMin:.15, lifeMax:.35, g:500 });
    }
  }
}

/* did it drop through the rim this substep? */
function checkThroughRim(o, prevY, prevX = o.x) {
  if (o.scored || o.dying > 0) return;
  const rimY = hoop.y + hoop.flex;
  // Score the swept movement, not the smoothed input velocity (which lags a curved dunk).
  if (o.y <= prevY) return;
  if (!(prevY < rimY && o.y >= rimY)) return;
  const t = clamp((rimY - prevY) / (o.y - prevY), 0, 1);
  const crossingX = lerp(prevX, o.x, t);
  if (Math.abs(crossingX - hoop.x) > rimRX() - o.r - CONFIG.HOOP.LIP_R) return;
  if (o.held) { o.held = false; stroke.grab = null; o.manual = true; }
  if (o.kind === "ball") scoreDunk(o);
  else if (o.kind === "crown") scoreCrown(o);
  else if (o.kind === "bomb") { G.score = Math.max(0, G.score + CONFIG.SCORE.BOMB_IN_HOOP);
    pop(hoop.x, hoop.y + 70, fmt(CONFIG.SCORE.BOMB_IN_HOOP), "#ff3b5c", 30); detonate(o, true); }
}

function checkOutOfPlay(o) {
  // a bomb swiped off either side (or way over the top) is safely disposed of
  if (o.kind === "bomb" && (o.x < -o.r - 60 || o.x > W + o.r + 60 || o.y < -520)) {
    o.alive = false;
    addMeter(CONFIG.HELPER.PER_BOMB_CLEARED);
    G.bombsCleared = (G.bombsCleared || 0) + 1;
    pop(clamp(o.x, 50, W - 50), clamp(o.y, 120, H - 120), "CLEARED", "#8ef5a0", 22);
    Sound.click(); haptic(8);
    return;
  }
  if (o.y - o.r < H + 120) return;              // still on (or just under) screen
  if (o.kind === "bomb") { detonate(o, true); return; }
  if (o.kind === "ball") {
    o.alive = false;
    // a dropped ball is only a lost opportunity - the combo bar does the punishing
    return;
  }
  o.alive = false;                               // a crown simply leaves
}

/* ball-to-ball contact, which is what makes an alley-oop possible */
function collideObjects(dt) {
  for (let i = 0; i < objs.length; i++) {
    const a = objs[i]; if (!a.alive || a.scored || a.held) continue;
    for (let j = i + 1; j < objs.length; j++) {
      const b = objs[j]; if (!b.alive || b.scored || b.held) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
      const d = Math.hypot(dx, dy);
      if (d >= min || d < .0001) continue;
      const nx = dx / d, ny = dy / d, overlap = min - d;
      a.x -= nx * overlap * .5; a.y -= ny * overlap * .5;
      b.x += nx * overlap * .5; b.y += ny * overlap * .5;
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
      const vn = rvx * nx + rvy * ny;
      if (vn > 0) continue;
      const imp = -(1.55) * vn / 2;
      a.vx -= imp * nx; a.vy -= imp * ny;
      b.vx += imp * nx; b.vy += imp * ny;
      Sound.board();
      burst((a.x + b.x) / 2, (a.y + b.y) / 2, 5, { c:["#fff","#ffd23f"], spMin:60, spMax:220,
        rMin:2, rMax:4, lifeMin:.12, lifeMax:.3, g:600 });
      // freshly-swiped ball strikes another -> the struck one is an oop candidate
      const t = G.elapsed;
      if (a.kind === "ball" && b.kind === "ball") {
        if (t - a.lastSwipeT < 0.8 && !a.scored) { b.alleyOop = true; b.lastSwipeY = Math.min(b.lastSwipeY, b.y); }
        if (t - b.lastSwipeT < 0.8 && !b.scored) { a.alleyOop = true; a.lastSwipeY = Math.min(a.lastSwipeY, a.y); }
      }
    }
  }
}

/* ==================================================================
   9. INPUT - grab, drag and flick
   ------------------------------------------------------------------
   Press on a ball and it sticks to your finger; drag it where you want
   it and let go to throw it with the speed your finger was moving.
   A fast swipe that merely passes THROUGH a ball still flicks it, so
   both a deliberate drag and a quick slash work.
   ================================================================== */
const stroke = {
  active: false, id: null, pts: [], turn: 0, lastAng: null,
  grab: null, grabT: 0
};
const nowSec = () => performance.now() / 1000;

function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}

/* Velocity is fitted over the last SAMPLE_WINDOW of REAL time. It used
   to use the frame clock, which collapses to zero when several pointer
   events land inside one frame. */
function strokeVelocity() {
  const pts = stroke.pts;
  if (pts.length < 2) return { vx: 0, vy: 0, sp: 0 };
  const now = pts[pts.length - 1];
  let ref = pts[0];
  for (let i = pts.length - 2; i >= 0; i--) {
    ref = pts[i];
    if (now.t - pts[i].t >= CONFIG.SWIPE.SAMPLE_WINDOW) break;
  }
  const dt = Math.max(0.008, now.t - ref.t);
  const vx = (now.x - ref.x) / dt, vy = (now.y - ref.y) / dt;
  return { vx, vy, sp: Math.hypot(vx, vy) };
}

function pushPoint(p) {
  p.t = nowSec();
  const pts = stroke.pts;
  if (pts.length) {
    const prev = pts[pts.length - 1];
    if (Math.hypot(p.x - prev.x, p.y - prev.y) > 7) {
      const ang = Math.atan2(p.y - prev.y, p.x - prev.x);
      if (stroke.lastAng !== null) stroke.turn += angDelta(stroke.lastAng, ang);
      stroke.lastAng = ang;
    }
  }
  pts.push(p);
  if (pts.length > CONFIG.SWIPE.HISTORY) pts.shift();
}

/* ---- what did the finger land on? --------------------------------
   Balls get a generous reach, bombs a reduced one, and if a ball is
   anywhere near the press the bomb underneath it is not considered at
   all. An ambiguous press therefore always resolves to the ball.   */
function pickGrab(p) {
  const SW = CONFIG.SWIPE;
  let best = null, bestScore = Infinity, ballNear = false;
  for (const o of objs) {
    if (!o.alive) continue;
    const d = dist(p.x, p.y, o.x, o.y);
    const reach = o.kind === "bomb"
      ? o.r + SW.GRAB_RADIUS - SW.BOMB_DEADZONE
      : o.r + SW.GRAB_RADIUS + SW.BALL_BIAS;
    if (d > reach) continue;
    if (o.kind !== "bomb" && d <= o.r + SW.BALL_PRIORITY_PAD) ballNear = true;
    const score = o.kind === "bomb" ? d + 10000 : d;   // balls always win
    if (score < bestScore) { bestScore = score; best = o; }
  }
  if (best && best.kind === "bomb" && ballNear) return null;
  return best;
}

function grabObject(o, p) {
  stroke.grab = o; stroke.grabT = 0;
  o.held = true;
  o.heldOffX = clamp(o.x - p.x, -o.r, o.r);
  o.heldOffY = clamp(o.y - p.y, -o.r, o.r);
  o.hitCool = 0;
  o.trailT = 0.35;
  if (o.kind === "ball") {
    o.swiped = true;
    o.comboCarrier = true;
    for (const q of objs) if (q !== o && q.kind === "ball") q.comboCarrier = false;
  }
  Sound.click(); haptic(6);
  burst(o.x, o.y, 6, { c: o.kind === "bomb" ? ["#ff7043", "#fff"] : ["#ffd23f", "#fff"],
    spMin: 40, spMax: 170, rMin: 2, rMax: 4, lifeMin: .12, lifeMax: .3, g: 300 });
}

function dragTo(p) {
  const o = stroke.grab;
  if (!o || !o.alive) { stroke.grab = null; return; }
  const v = strokeVelocity();
  const nx = clamp(p.x + o.heldOffX, o.r, W - o.r);
  const ny = clamp(p.y + o.heldOffY, o.r - 80, H + 140);
  const steps = Math.max(1, Math.ceil(Math.hypot(nx-o.x, ny-o.y) / CONFIG.PHYSICS.STEP_DISTANCE));
  const dx = (nx-o.x)/steps, dy = (ny-o.y)/steps;
  o.vx = v.vx; o.vy = v.vy;
  for (let i=0; i<steps && o.held; i++) {
    const px=o.x, py=o.y;
    o.x += dx; o.y += dy; o.rot += dx/o.r;
    const tx=o.x, ty=o.y;
    collideHoop(o);
    checkThroughRim(o,py,px);
    // Stop at contact. A distant pointer sample must not pull a held ball through solid iron.
    if (Math.abs(o.x-tx)+Math.abs(o.y-ty)>.01) break;
  }
  if (v.sp > CONFIG.JUICE.TRAIL_MIN_SPEED) o.trailT = .4;
}

/* the scoring volume around the rim, generous enough to catch a drag */
function inRimMouth(o) {
  const rimY = hoop.y + hoop.flex;
  const M = CONFIG.HOOP.MOUTH;
  return Math.abs(o.x - hoop.x) < rimRX() * CONFIG.HOOP.SCORE_PAD &&
         o.y > rimY - M.ABOVE && o.y < rimY + M.BELOW;
}

/* a ball carried into the net still counts - it just does not earn tricks */
function manualFinish(o) {
  stroke.grab = null;
  o.held = false;
  if (o.kind === "bomb") {
    G.score = Math.max(0, G.score + CONFIG.SCORE.BOMB_IN_HOOP);
    pop(hoop.x, hoop.y + 70, fmt(CONFIG.SCORE.BOMB_IN_HOOP), "#ff3b5c", 26);
    detonate(o, true);
    return;
  }
  if (o.kind === "crown") { scoreCrown(o); return; }
  o.manual = true;
  scoreDunk(o);
}

function releaseGrab() {
  const o = stroke.grab;
  stroke.grab = null;
  if (!o || !o.alive) return;
  o.held = false;
  const SW = CONFIG.SWIPE;
  const v = strokeVelocity();
  const age = nowSec() - (stroke.pts.length ? stroke.pts[stroke.pts.length - 1].t : 0);
  const stale = age > 0.12;          // finger stopped before letting go
  const sp = stale ? 0 : v.sp;

  if (sp < SW.RELEASE_MIN) {          // stopped finger means no stored launch velocity
    o.vx = 0; o.vy = 0;
    return;
  }
  const imp = Math.min(sp * SW.RELEASE_POWER * (o.kind === "ball" ? equippedBall().power : 1),
                       SW.MAX_IMPULSE);
  const ux = v.vx / sp, uy = v.vy / sp;
  o.vx = ux * imp;
  o.vy = uy * imp - imp * SW.LIFT;
  o.spin = clamp(o.spin + clamp(stroke.turn, -3, 3) * SW.CURVE_SPIN * .35, -SW.MAX_SPIN, SW.MAX_SPIN);
  o.trailT = .6;

  if (o.kind === "ball") {
    o.lastSwipeT = G.elapsed;
    o.lastSwipeY = o.y;
    if (Math.abs(stroke.turn) >= SW.WINDMILL_TURN) o.windmill = true;
    o.assist = imp >= CONFIG.ASSIST.MIN_SPEED;
    addStyle(o);
  }
  Sound.whoosh(clamp(sp / 2600, .15, 1));
  haptic(8);
  burst(o.x, o.y, 7, { c: o.kind === "bomb" ? ["#ff7043", "#fff"] : ["#ffd23f", "#fff"],
    dir: Math.atan2(uy, ux), spread: .7, spMin: 90, spMax: 300, rMin: 2, rMax: 5,
    lifeMin: .12, lifeMax: .32, g: 400, shape: "spark" });
}

function onDown(e) {
  Sound.init(); Sound.resume();
  if (G.state !== ST.PLAY || stroke.active) return;
  const p = toWorld(e);
  stroke.active = true; stroke.id = e.pointerId;
  stroke.pts = []; stroke.turn = 0; stroke.lastAng = null;
  pushPoint(p);
  const g = pickGrab(p);
  if (g) grabObject(g, p);
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  hideCoach();
  e.preventDefault();
}

function onMove(e) {
  if (!stroke.active || e.pointerId !== stroke.id) return;
  if (G.state !== ST.PLAY) { releaseGrab(); stroke.active = false; return; }
  // getCoalescedEvents() can legitimately return an empty list; fall back
  // to the event itself or the drag silently does nothing.
  let list = null;
  if (e.getCoalescedEvents) { try { list = e.getCoalescedEvents(); } catch (err) { list = null; } }
  if (!list || !list.length) list = [e];
  for (const ce of list) {
    const p = toWorld(ce);
    const prev = stroke.pts[stroke.pts.length - 1];
    pushPoint(p);
    if (stroke.grab) dragTo(p);
    else if (prev) resolveSwipe(prev, p);
  }
  e.preventDefault();
}

function onUp(e) {
  if (e.pointerId !== stroke.id) return;
  releaseGrab();
  stroke.active = false; stroke.id = null;
  stroke.pts = []; stroke.turn = 0; stroke.lastAng = null;
  try { cv.releasePointerCapture(e.pointerId); } catch (err) {}
}

/* ---- flick-through: a fast swipe that crosses an object it did not
   start on. Same precision rules as the press test.               */
function resolveSwipe(p0, p1) {
  const SW = CONFIG.SWIPE;
  const v = strokeVelocity();
  if (v.sp < SW.MIN_SPEED) return;

  const cands = [];
  let ballNear = false;
  for (const o of objs) {
    if (!o.alive || o.held || o.hitCool > 0) continue;
    const hit = segDist(o.x, o.y, p0.x, p0.y, p1.x, p1.y);
    const grab = o.kind === "bomb" ? o.r - SW.BOMB_DEADZONE : o.r + SW.BALL_BIAS;
    if (hit.d > grab) continue;
    if (o.kind !== "bomb" && hit.d <= o.r + SW.BALL_PRIORITY_PAD) ballNear = true;
    cands.push({ o, d: hit.d, x: hit.x, y: hit.y });
  }
  if (!cands.length) return;
  for (const c of cands) {
    if (ballNear && c.o.kind === "bomb") continue;   // never resolve to the bomb
    applySwipe(c.o, c.x, c.y, v);
  }
}


/* ---- SKILLS: every touch after the first builds style on that ball ----
   Flick it back up, load it with spin, pop it high - the ball remembers,
   and the whole dunk is multiplied by what you built. */
function addStyle(o) {
  if (o.kind !== "ball") return;
  const ST = CONFIG.STYLE;
  o.touches++;
  if (o.touches < 2) return;                   // the first touch is just a shot
  // a juggle is a deliberate, rhythmic lift - not a burst of taps
  if (G.elapsed - (o.lastStyleT || -9) < ST.MIN_GAP) return;
  if (o.vy > -ST.MIN_LIFT) return;             // it did not really go up
  o.lastStyleT = G.elapsed;
  let gain = ST.PER_JUGGLE;
  if (Math.abs(o.spin) >= ST.SPIN_MIN) gain += ST.SPIN_BONUS;
  if (o.y < H * ST.HIGH_Y) gain += ST.HIGH_BONUS;
  const before = styleLevel(o);
  o.style += gain;
  const after = styleLevel(o);
  if (after > before) {
    pop(o.x, o.y - o.r - 18, ST.NAMES[after], ST.COLOURS[after], 22 + after * 2);
    Sound.coin(); haptic(10);
    burst(o.x, o.y, 10, { c: [ST.COLOURS[after], "#ffffff"], spMin: 70, spMax: 250,
      rMin: 2, rMax: 5, lifeMin: .2, lifeMax: .5, g: 250 });
  }
}
const styleLevel = o => Math.min(CONFIG.STYLE.MAX_LEVEL,
  Math.floor((o.style || 0) / CONFIG.STYLE.PER_LEVEL));
const styleMult = o => 1 + styleLevel(o) * CONFIG.STYLE.MULT_PER_LEVEL;

function applySwipe(o, hx, hy, v) {
  const SW = CONFIG.SWIPE, bm = equippedBall();
  const power = o.kind === "ball" ? bm.power : 1;
  const imp = Math.min(v.sp * SW.POWER * power, SW.MAX_IMPULSE);
  const ux = v.vx / v.sp, uy = v.vy / v.sp;

  o.vx = lerp(o.vx, ux * imp, .88);
  o.vy = lerp(o.vy, uy * imp - imp * SW.LIFT, .88);

  const offx = o.x - hx, offy = o.y - hy;
  const cross = ux * offy - uy * offx;
  let spin = cross * SW.OFFSET_SPIN * (v.sp / 900);
  spin += clamp(stroke.turn, -3, 3) * SW.CURVE_SPIN * .35;
  o.spin = clamp(o.spin + spin, -SW.MAX_SPIN, SW.MAX_SPIN);

  o.hitCool = SW.COOLDOWN;
  if (v.sp > CONFIG.JUICE.TRAIL_MIN_SPEED) o.trailT = .55;

  if (o.kind === "ball") {
    o.swiped = true;
    o.lastSwipeT = G.elapsed;
    o.lastSwipeY = o.y;
    if (Math.abs(stroke.turn) >= SW.WINDMILL_TURN) o.windmill = true;
    o.comboCarrier = true;
    for (const other of objs) if (other !== o && other.kind === "ball") other.comboCarrier = false;
    o.assist = Math.hypot(o.vx, o.vy) >= CONFIG.ASSIST.MIN_SPEED;
    addStyle(o);
  }
  if (o.kind === "bomb") { o.fuse = Math.max(0, o.fuse - .2); Sound.fuse(); }

  Sound.whoosh(clamp(v.sp / 2600, .15, 1));
  haptic(6);
  burst(hx, hy, 5, { c: o.kind === "bomb" ? ["#ff7043", "#fff"] : ["#ffd23f", "#fff"],
    dir: Math.atan2(uy, ux), spread: .8, spMin: 80, spMax: 280, rMin: 2, rMax: 5,
    lifeMin: .12, lifeMax: .3, g: 500, shape: "spark" });
}

/* ==================================================================
   10. SCORING, TRICKS AND THE COMBO CHAIN
   ================================================================== */
function comboWindow() {
  const C = CONFIG.COMBO;
  return Math.max(C.WINDOW_MIN, C.WINDOW - G.combo * C.WINDOW_STEP);
}
function multCap() { return CONFIG.MODES[G.mode].multCap ? CONFIG.COMBO.MULT_CAP : 999; }

function scoreDunk(o) {
  if (o.scored) return;
  const C = CONFIG.COMBO, J = CONFIG.JUICE;
  o.alive = false; o.scored = true;

  // ---- snapshot everything the trick tests need -------------------
  const othersAirborne = objs.filter(q => q.alive && q !== o && q.kind === "ball" && q.y < H).length;
  const snap = {
    hitRim: o.hitRim, hitBoard: o.hitBoard, surfaces: o.surfaces,
    windmill: o.windmill, spin: o.spin, alleyOop: o.alleyOop,
    launchY: o.lastSwipeY, othersAirborne,
    comboBefore: G.combo,
    sinceLastDunk: G.elapsed - G.lastDunkAt,
    buzzer: CONFIG.MODES[G.mode].seconds > 0 && G.timeLeft <= 3,
    manual: !!o.manual
  };

  // ---- which tricks landed ----------------------------------------
  // a ball placed in by hand scores, but it is not a trick
  const got = snap.manual ? [] : TRICKS.filter(t => { try { return t.test(snap); } catch (e) { return false; } });
  const primary = got.reduce((a, b) => (!a || b.pts > a.pts) ? b : a, null);

  // ---- variety: new tricks pay, repeats die off --------------------
  let trickPts = got.reduce((s, t) => s + t.pts, 0);
  let varietyLabel = "";
  if (primary) {
    if (primary.id === G.lastTrickId) {
      G.repeatRun++;
      const d = C.REPEAT_DECAY[Math.min(G.repeatRun, C.REPEAT_DECAY.length - 1)];
      trickPts *= d;
      if (d <= .3) varietyLabel = "SAME OLD";
    } else {
      G.repeatRun = 0;
      trickPts *= 1 + C.VARIETY_BONUS;
      varietyLabel = "FRESH";
    }
    G.lastTrickId = primary.id;
    G.tricks += got.length;
    SAVE.stats.tricks += got.length;
    for (const t of got) G.trickCounts[t.id] = (G.trickCounts[t.id] || 0) + 1;
  } else {
    G.lastTrickId = null; G.repeatRun = 0;
  }

  // ---- combo ladder ------------------------------------------------
  G.combo++;
  G.comboT = comboWindow();
  G.mult = Math.min(1 + Math.floor(G.combo / C.MULT_STEP), multCap());
  G.bestCombo = Math.max(G.bestCombo, G.combo);

  // ---- points --------------------------------------------------------
  const dbl = G.helperActive === "double" ? 2 : 1;
  const sLv = styleLevel(o), sMult = styleMult(o);
  const pts = Math.round((CONFIG.SCORE.DUNK + trickPts) * G.mult * rankMult() * dbl * sMult);
  G.score += pts;
  G.dunks++; SAVE.stats.dunks++;
  G.lastDunkAt = G.elapsed;
  addCrowns((pts / CONFIG.CROWNS.PER_POINTS) + got.length * CONFIG.CROWNS.PER_TRICK);
  addMeter(CONFIG.HELPER.PER_DUNK + got.length * CONFIG.HELPER.PER_TRICK);

  // ---- juice ----------------------------------------------------------
  const rimY = hoop.y + hoop.flex;
  hoop.netV += J.NET_WHIP;
  hoop.flexV += 240;
  hoop.pulse = J.SCORE_PULSE;
  hoop.clean = !o.manual && !o.hitRim && !o.hitBoard;
  hoop.netSideV = (hoop.netSideV || 0) + clamp(o.vx * .22, -160, 160);
  // the ball keeps falling through the net instead of vanishing on contact
  o.alive = true; o.dying = J.BALL_DROP_TIME;
  o.vx *= .25; o.vy = clamp(o.vy, 260, 420);
  pop(hoop.x, rimY + 60, "+" + fmt(pts), primary ? primary.colour : "#fff4e0", primary ? 34 : 28);
  if (primary) {
    pop(hoop.x, rimY + 16, primary.name, primary.colour, 26);
    if (got.length > 1) pop(hoop.x, rimY + 104, "x" + got.length + " TRICKS", "#ffd23f", 19);
    else if (varietyLabel) pop(hoop.x, rimY + 104, varietyLabel, varietyLabel === "FRESH" ? "#8ef5a0" : "#b09aa4", 17);
    callTrick(primary.name, primary.colour);
    Sound.trick(); Sound.cheer(1.4);
    Shake.add(J.SHAKE_TRICK); flash(J.FLASH_TRICK); haptic(J.HAPTIC_TRICK);
    spriteFx(IMG.burst, hoop.x, rimY, 300, .5, rand(0, TAU), rand(-2, 2));
  } else {
    if (snap.manual) pop(hoop.x, rimY + 16, "HAND DUNK", "#fff4e0", 22);
    Sound.cheer(.7); Shake.add(J.SHAKE_DUNK); flash(J.FLASH_DUNK); haptic(J.HAPTIC_DUNK);
  }
  if (snap.manual) Sound.swish();
  else if (snap.hitRim === 0 && snap.hitBoard === 0) Sound.swish(); else Sound.clank();
  if (G.mult >= 3) pop(hoop.x + 120, rimY + 40, "x" + G.mult, "#ffd23f", 24);
  if (sLv > 0) {
    pop(hoop.x - 130, rimY + 40,
        CONFIG.STYLE.NAMES[sLv] + " x" + sMult.toFixed(1),
        CONFIG.STYLE.COLOURS[sLv], 22 + sLv * 2);
    Shake.add(2 * sLv);
  }

  spriteFx(IMG.sparkle, hoop.x, rimY + 10, 200, .42, rand(0, TAU), 1.4);
  burst(hoop.x, rimY + 20, 22, {
    c: ["#ffd23f","#fff4e0","#e0243a","#ff9b2f"], dir: Math.PI / 2, spread: 1.05,
    spMin: 140, spMax: 520, rMin: 3, rMax: 8, lifeMin: .3, lifeMax: .8, g: 900
  });
  bumpScore();

  // ---- OVERTIME ---------------------------------------------------------
  if (CONFIG.MODES[G.mode].overtime && !G.overtime && G.combo >= CONFIG.OVERTIME.TRIGGER_COMBO) startOvertime();
}

function scoreCrown(o) {
  o.alive = false;
  const val = Math.round(o.value * equippedBall().crowns);
  const pts = Math.round(CONFIG.SCORE.CROWN_PICKUP * G.mult * rankMult() *
                         (G.helperActive === "double" ? 2 : 1));
  G.score += pts;
  addCrowns(val);
  G.combo++; G.comboT = comboWindow();
  G.mult = Math.min(1 + Math.floor(G.combo / CONFIG.COMBO.MULT_STEP), multCap());
  G.bestCombo = Math.max(G.bestCombo, G.combo);
  addMeter(CONFIG.HELPER.PER_DUNK);
  const col = o.tier === "gold" ? "#ffd23f" : o.tier === "silver" ? "#e8eef7" : "#e08a48";
  pop(hoop.x, hoop.y + 40, "+" + val + " CROWNS", col, 30);
  pop(hoop.x, hoop.y + 96, "+" + fmt(pts), "#fff4e0", 22);
  Sound.crown(); Sound.cheer(1.1); Shake.add(9); flash(.16); haptic([10, 20, 10]);
  spriteFx(IMG.sparkle, hoop.x, hoop.y + 10, 230, .45, rand(0, TAU), 2);
  hoop.netV += CONFIG.JUICE.NET_WHIP; bumpScore();
}

function addCrowns(v) {
  G.crownsRun += v;
  SAVE.crowns += v;
  SAVE.stats.crownsEarned += v;
  bumpCrowns();
}
function addMeter(v) {
  if (G.helperActive) return;                       // no charging mid-ability
  G.helperMeter = Math.min(CONFIG.HELPER.METER_MAX, G.helperMeter + v);
}

/* ==================================================================
   11. BOMBS
   ================================================================== */
function detonate(o, penalty) {
  if (!o.alive) return;
  o.alive = false;
  const J = CONFIG.JUICE;
  const y = Math.min(o.y, H - 40);
  spriteFx(IMG.burst, o.x, y, 420, .55, rand(0, TAU), rand(-3, 3));
  burst(o.x, y, 30, { c: ["#ff7043","#ffd23f","#fff","#8a8a8a"], spMin: 160, spMax: 620,
    rMin: 3, rMax: 10, lifeMin: .3, lifeMax: .85, g: 700 });
  Sound.bomb();

  if (!penalty) {                                   // cleared safely (Sweeper)
    addMeter(CONFIG.HELPER.PER_BOMB_CLEARED);
    Shake.add(8); haptic(20);
    return;
  }

  SAVE.stats.bombs++;
  Shake.add(J.SHAKE_BOMB); flash(J.FLASH_BOMB); haptic(J.HAPTIC_BOMB);
  breakCombo("BOOM");

  const md = CONFIG.MODES[G.mode];
  if (md.lives > 0) {
    G.lives--;
    updateLivesUI();
    if (G.lives <= 0) { pop(W / 2, H * .45, "GAME OVER", "#ff3b5c", 40); endRun("bomb"); return; }
    pop(o.x, y - 40, "-1 LIFE", "#ff3b5c", 28);
  } else if (md.seconds > 0 && md.bombSeconds) {
    G.timeLeft = Math.max(0, G.timeLeft - md.bombSeconds);
    pop(o.x, y - 40, "-" + md.bombSeconds + "s", "#ff3b5c", 28);
  }
}
function breakCombo(label) {
  if (G.combo > 0 && label) pop(W / 2, H * .38, label, "#ff3b5c", 30);
  G.combo = 0; G.mult = 1; G.comboT = 0;
  G.lastTrickId = null; G.repeatRun = 0;
  for (const o of objs) o.comboCarrier = false;
}

/* ==================================================================
   12. OVERTIME
   ================================================================== */
function startOvertime() {
  G.overtime = true;
  G.overtimeT = CONFIG.OVERTIME.DURATION;
  G.overtimesThisRun++;
  SAVE.stats.overtimes++;
  if (CONFIG.OVERTIME.TIME_BONUS) G.timeLeft += CONFIG.OVERTIME.TIME_BONUS;
  // clear the bombs currently in the air - overtime is pure reward
  for (const o of objs) if (o.kind === "bomb") detonate(o, false);
  pop(W / 2, H * .34, "OVERTIME!", "#ffd23f", 48);
  Sound.rankUp(); Sound.cheer(2); flash(.4); Shake.add(16); haptic([20, 40, 20, 40, 60]);
  banner("OVERTIME");
}
function endOvertime() {
  G.overtime = false;
  pop(W / 2, H * .34, "TIME", "#fff4e0", 30);
  Sound.fail();
}

/* ==================================================================
   13. HELPERS / COMPANION ABILITIES
   ================================================================== */
function useHelper() {
  if (G.state !== ST.PLAY) return;
  if (G.helperActive) return;
  if (G.helperMeter < CONFIG.HELPER.METER_MAX) { Sound.fail(); haptic(30); return; }
  const h = equippedHelper();
  G.helperMeter = 0;
  G.helperActive = h.ability;
  G.helperT = h.dur;
  G.helperUses++;
  Sound.ability(); Sound.cheer(1.2); flash(.22); Shake.add(10); haptic([14, 28, 14]);
  banner(h.name.toUpperCase());

  if (h.ability === "wide") hoop.wide = 1.5;
  if (h.ability === "sweep") {
    let n = 0;
    for (const o of objs) if (o.kind === "bomb" && o.alive) { detonate(o, false); n++; }
    pop(W / 2, H * .42, n ? "COURT CLEARED" : "ALL CLEAR", "#8ef5a0", 30);
  }
  updateHelperUI();
}
function endHelper() {
  if (G.helperActive === "wide") hoop.wide = 1;
  G.helperActive = null; G.helperT = 0;
  updateHelperUI();
}
let bannerT = 0;
function banner(text) {
  const el = $("abilityBanner");
  el.textContent = text;
  el.classList.add("on");
  bannerT = 1.6;
}

/* ==================================================================
   14. RUN LIFECYCLE
   ================================================================== */
function startRun(mode) {
  if (glRenderer?.lost) return;
  const md = CONFIG.MODES[mode];
  G.mode = mode; G.state = ST.PLAY;
  G.score = 0; G.dunks = 0; G.tricks = 0; G.crownsRun = 0;
  G.combo = 0; G.mult = 1; G.comboT = 0; G.bestCombo = 0;
  G.lastTrickId = null; G.repeatRun = 0; G.trickCounts = {};
  G.lives = md.lives; G.maxLives = md.lives;
  G.timeLeft = md.seconds; G.elapsed = 0; G.difficulty = 0;
  G.spawnT = CONFIG.SPAWN.FIRST_DELAY;
  G.lastDunkAt = -99;
  G.overtime = false; G.overtimeT = 0; G.overtimesThisRun = 0;
  G.timeScale = 1; G.slowT = 0; G.slowUsed = false;
  G.helperMeter = 0; G.helperActive = null; G.helperT = 0; G.helperUses = 0;
  G.newBest = false; G.ended = false; G.bombsCleared = 0; G.buzzerT = 0;
  objs.length = 0; P.length = 0; POPS.length = 0;
  stroke.grab = null; stroke.active = false; stroke.pts = [];
  hoop.wide = 1; hoop.flex = 0; hoop.flexV = 0; hoop.net = 0; hoop.netV = 0;
  hoop.swayT = 0; hoop.pulse = 0; hoop.netSide = 0; hoop.netSideV = 0; hoop.boardPulse = 0;
  trickCall.t = 0;
  SAVE.stats.runs++;

  $("modeTag").textContent = "";
  $("timeLabel").textContent = mode === "time" ? "Time" : mode === "arcade" ? "Arcade" : "Sudden Death";
  updateLivesUI(); updateHelperUI(); updateHUD();
  showHUD(true); showScreen(null);
  Sound.ambience(true);
  if (SAVE.stats.runs <= 2) coach();
  save();
}

function endRun(reason) {
  if (G.ended) return;
  G.ended = true;
  G.state = ST.OVER;
  G.timeScale = 1;
  stroke.grab = null; stroke.active = false;
  endHelper();
  showHUD(false);
  Sound.ambience(false);

  // crowns are already banked live; fold in the run stats
  SAVE.stats.bestCombo = Math.max(SAVE.stats.bestCombo, G.bestCombo);
  if (G.score > (SAVE.best[G.mode] || 0)) { SAVE.best[G.mode] = G.score; G.newBest = true; }
  if (G.score > 0) {
    SAVE.scores.push({ name: SAVE.name || "YOU", score: G.score, mode: G.mode, date: Date.now() });
    SAVE.scores.sort((a, b) => b.score - a.score);
    SAVE.scores = SAVE.scores.slice(0, 10);
  }

  // rank progress
  const before = SAVE.rank;
  SAVE.xp += Math.round(G.score * CONFIG.RANK.XP_PER_POINT);
  while (SAVE.xp >= xpForRank(SAVE.rank + 1)) SAVE.rank++;
  const gained = SAVE.rank - before;
  saveNow();

  buildResults(reason);
  showScreen("scResults");
  if (gained > 0) queueRankCards(before, SAVE.rank);
}

/* slow motion on the shot that decides the run */
function maybeFinalSlowmo() {
  if (G.slowUsed || G.slowT > 0) return;
  const md = CONFIG.MODES[G.mode];
  const clutch = (md.seconds > 0 && G.timeLeft <= 1.0) || (md.lives > 0 && G.lives === 1);
  if (!clutch) return;
  for (const o of objs) {
    if (!o.alive || o.kind === "bomb" || o.vy <= 0) continue;
    if (dist(o.x, o.y, hoop.x, hoop.y) < 240) {
      G.slowUsed = true; G.slowT = CONFIG.JUICE.SLOWMO_TIME; flash(.12);
      return;
    }
  }
}

/* ==================================================================
   15. UPDATE
   ================================================================== */
function update(dt) {
  if (G.state === ST.PAUSED) return;
  G.elapsed += dt;

  // timescale: clutch slow-motion, or the Chill companion
  let ts = 1;
  if (G.slowT > 0) { G.slowT -= dt; ts = CONFIG.JUICE.SLOWMO_SCALE; }
  else if (G.helperActive === "slow") ts = 0.34;
  G.timeScale = ts;
  const sdt = dt * ts;

  Shake.update(dt);
  updateFlash(dt);
  updateP(sdt);
  updatePops(dt);
  updateHoopSprings(sdt);

  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("abilityBanner").classList.remove("on"); }

  if (G.state !== ST.PLAY) return;

  // difficulty ramp
  const md = CONFIG.MODES[G.mode];
  G.difficulty = clamp(G.elapsed / (CONFIG.SPAWN.RAMP_SECONDS / md.ramp), 0, 1);

  // helper ability timer
  if (G.helperActive) {
    G.helperT -= dt;
    if (G.helperT <= 0) endHelper();
    updateHelperUI();
  }

  // overtime timer
  if (G.overtime) {
    G.overtimeT -= dt;
    if (G.overtimeT <= 0) endOvertime();
  }

  // you cannot carry a ball around forever
  if (stroke.grab) {
    stroke.grabT += dt;
    if (stroke.grabT > CONFIG.SWIPE.GRAB_MAX_TIME) releaseGrab();
  }

  // combo decay bar
  if (G.combo > 0) {
    G.comboT -= dt;
    if (G.comboT <= 0) breakCombo("COMBO LOST");
  }

  // spawner
  G.spawnT -= sdt;
  if (G.spawnT <= 0) {
    throwObject();
    if (Math.random() < CONFIG.SPAWN.DOUBLE_CHANCE * (0.5 + G.difficulty)) {
      setTimeout(() => { if (G.state === ST.PLAY) throwObject(); }, CONFIG.SPAWN.DOUBLE_GAP * 1000);
    }
    G.spawnT = spawnInterval();
  }

  stepObjects(sdt);
  maybeFinalSlowmo();

  // the clock
  if (md.seconds > 0) {
    G.timeLeft -= dt;
    if (G.timeLeft <= 0) {
      G.timeLeft = 0;
      // let a shot already in the air finish before the buzzer
      const live = objs.some(o => o.alive && o.kind !== "bomb" && o.vy > 0 && o.y < hoop.y + 100 && o.y > 0);
      G.buzzerT += dt;
      if (!live || G.buzzerT >= 1.2) { updateHUD(); endRun("time"); return; }
    }
  }
  updateHUD();
}

function updateHoopSprings(dt) {
  const C = CONFIG.HOOP;
  hoop.flexV += (-C.FLEX_SPRING * hoop.flex - C.FLEX_DAMP * hoop.flexV) * dt;
  hoop.flex += hoop.flexV * dt;
  hoop.netV += (-C.NET_SPRING * hoop.net - C.NET_DAMP * hoop.netV) * dt;
  hoop.net += hoop.netV * dt;
  hoop.netSideV = (hoop.netSideV || 0) + (-65 * (hoop.netSide || 0) - 8 * (hoop.netSideV || 0)) * dt;
  hoop.netSide = (hoop.netSide || 0) + hoop.netSideV * dt;
  hoop.boardPulse = Math.max(0, (hoop.boardPulse || 0) - dt);
  if (hoop.pulse > 0) hoop.pulse = Math.max(0, hoop.pulse - dt);
  hoop.swayT += dt * C.SWAY_SPEED;
  hoop.x = hoopBaseX() + Math.sin(hoop.swayT * TAU) * C.SWAY;
}

/* ==================================================================
   16. CANVAS
   ================================================================== */
function createRenderSurface() {
  let canvas = $('game');
  const forceCanvas = typeof location !== 'undefined' && new URLSearchParams(location.search).get('renderer') === 'canvas';
  if (typeof CourtGL !== 'undefined' && !forceCanvas) {
    const gpu = CourtGL.create(canvas);
    if (gpu) return {canvas, gpu, context:null};
    // A canvas which acquired WebGL cannot subsequently acquire a 2D context.
    const replacement = canvas.cloneNode(false);
    canvas.replaceWith(replacement);canvas=replacement;
  }
  canvas.dataset.renderer='canvas2d';
  return {canvas,gpu:null,context:canvas.getContext('2d',{alpha:false})};
}
const renderSurface = createRenderSurface();
const cv = renderSurface.canvas, ctx = renderSurface.context, glRenderer = renderSurface.gpu;
let SCALE = 1, DPR = 1;
let lastCW = 0, lastCH = 0;
function resize() {
  const r = cv.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return;   // called before layout: ignore
  lastCW = cv.clientWidth; lastCH = cv.clientHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.max(1, Math.round(r.width * DPR));
  cv.height = Math.max(1, Math.round(r.height * DPR));
  // The world keeps a constant height and grows sideways to match the device,
  // so a 20:9 phone gets more court rather than black bars.
  const aspect = clamp((r.width || 16) / (r.height || 9),
                       CONFIG.WORLD.ASPECT_MIN, CONFIG.WORLD.ASPECT_MAX);
  W = Math.round(H * aspect);
  SCALE = cv.height / H;
  hoop.x = hoopBaseX();
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 120));
// A window resize event is not always enough: rotation, on-screen keyboards,
// split screen and browser chrome all change the canvas box without one.
if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(cv); } catch (e) {} }
/* last line of defence - a cheap per-frame check that costs no layout */
function ensureSized() {
  if (cv.clientWidth !== lastCW || cv.clientHeight !== lastCH) resize();
}

/* ==================================================================
   17. DRAWING
   ================================================================== */
let lastDt = 1 / 60;
function draw() {
  if (glRenderer) { drawWebGL(glRenderer, lastDt); return; }
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.save();
  ctx.translate(Shake.x, Shake.y);

  drawCourt();
  drawHoopBack();
  drawShotGuide();
  drawObjects();
  drawHoopFront();
  drawP(ctx);
  drawTrickCall(lastDt);
  drawPops(ctx);
  drawOvertimeTint();

  ctx.restore();
}

function drawCourt() {
  const c = equippedCourt(), img = IMG.courtsAtlas || IMG[c.img];
  if (img && img.width) {
    // Use the clean right side of each supplied scene: the baked-in left hoop is excluded.
    const sx=330, sy=[0,344,686][c.panel], sw=1206, sh=337;
    const scale=Math.max((W+16)/sw,(H+16)/sh), dw=sw*scale, dh=sh*scale;
    ctx.drawImage(img,sx,sy,sw,sh,(W-dw)/2,(H-dh)/2,dw,dh);
  } else { ctx.fillStyle = "#2a1820"; ctx.fillRect(0, 0, W, H); }
  // grade + vignette so the HUD and the balls stay readable over the art
  ctx.fillStyle = c.tint;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, "rgba(8,3,10,.55)");
  v.addColorStop(.22, "rgba(8,3,10,.08)");
  v.addColorStop(.78, "rgba(8,3,10,.05)");
  v.addColorStop(1, "rgba(8,3,10,.6)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

/* everything above the rim line: board, arm, back of the rim */
function drawHoopBack() {
  HoopArt.back(ctx,IMG.hoop,hoopOrigin(),CONFIG.HOOP);
}

/* the front lip and the net, redrawn over the balls so a make actually
   drops BEHIND the net - and stretched downward for the net whip */
function drawHoopFront() {
  const rimY = hoop.y + hoop.flex;
  HoopArt.front(ctx,IMG.hoop,hoopOrigin(),CONFIG.HOOP,hoop);

  // --- the dunk reaction: a shockwave off the rim and a flash through the net
  if (hoop.pulse > 0) {
    const k = hoop.pulse / CONFIG.JUICE.SCORE_PULSE;        // 1 -> 0
    const grow = 1 - k;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // expanding ring
    ctx.strokeStyle = "rgba(255,200,61," + (k * 0.85) + ")";
    ctx.lineWidth = 3 + 9 * k;
    ctx.beginPath();
    ctx.ellipse(hoop.x, rimY, rimRX() * (1 + grow * 1.5), rimRY() * (1 + grow * 3.2), 0, 0, TAU);
    ctx.stroke();
    // hot glow sitting in the mouth of the rim
    const g2 = ctx.createRadialGradient(hoop.x, rimY + 18, 4, hoop.x, rimY + 18, rimRX() * 1.3);
    g2.addColorStop(0, "rgba(255,240,190," + (k * 0.55) + ")");
    g2.addColorStop(1, "rgba(255,150,40,0)");
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(hoop.x, rimY + 18, rimRX() * 1.3, 0, TAU); ctx.fill();
    ctx.restore();
    if (hoop.clean) {
      ctx.save();ctx.globalAlpha=k;
      CourtArt.paint(ctx,'perfect',hoop.x-110,rimY-148-(1-k)*30,220,140);
      ctx.restore();
    }
  }

  if (hoop.wide > 1) {                       // Wideboy: show the enlarged target
    ctx.save();
    ctx.strokeStyle = "rgba(142,245,160,.85)"; ctx.lineWidth = 5;
    ctx.setLineDash([16, 12]); ctx.lineDashOffset = -G.elapsed * 40;
    ctx.beginPath(); ctx.ellipse(hoop.x, rimY, rimRX(), rimRY() * 1.6, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

/* A short ballistic preview shows direction and power without steering the released ball. */
function drawShotGuide() {
  const o=stroke.grab; if(!o || o.kind!=='ball' || G.state!==ST.PLAY)return;
  const v=strokeVelocity(), sw=CONFIG.SWIPE;
  if(nowSec()-(stroke.pts.at(-1)?.t || 0)>.12)return;
  if(v.sp<sw.RELEASE_MIN)return;
  const power=Math.min(v.sp*sw.RELEASE_POWER*equippedBall().power,sw.MAX_IMPULSE);
  let x=o.x,y=o.y,vx=v.vx/v.sp*power,vy=v.vy/v.sp*power-power*sw.LIFT;
  const b=boardRect();
  ctx.save();
  for(let i=0;i<24;i++){
    vy+=CONFIG.PHYSICS.GRAVITY*o.grav*.025;x+=vx*.025;y+=vy*.025;
    if(y>H || x<o.r || x>W-o.r)break;
    if(x+o.r>b.x && x-o.r<b.x+b.w && y+o.r>b.y && y-o.r<b.y+b.h)break;
    if([-1,1].some(s=>Math.hypot(x-hoop.x-s*rimRX(),y-hoop.y-hoop.flex)<o.r+CONFIG.HOOP.LIP_R))break;
    ctx.globalAlpha=(1-i/24)*.8;ctx.fillStyle='#ffe79a';ctx.beginPath();ctx.arc(x,y,3.5-i*.07,0,TAU);ctx.fill();
  }
  ctx.restore();
}

function drawObjects() {
  for (const o of objs) {
    if (!o.alive) continue;
    drawTrail(o);
    if (o.kind === "ball") drawBall(o);
    else if (o.kind === "bomb") drawBomb(o);
    else drawCrown(o);
  }
}

function drawTrail(o) {
  if (!o.trail.length) return;
  const sprite = o.kind === "ball" ? IMG[equippedBall().trail] : (o.kind === "bomb" ? IMG.trailSmoke : IMG.trailWarm);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < o.trail.length; i++) {
    const t = i / o.trail.length, p = o.trail[i];
    ctx.globalAlpha = t * .45;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (.3 + t * .7), 0, TAU);
    ctx.fillStyle = o.kind === "bomb" ? "#ff7043" : "#ffd23f";
    ctx.fill();
  }
  // the painted streak from the art sheet, aligned to travel direction
  if (sprite && sprite.width && o.trail.length > 4) {
    const sp = Math.hypot(o.vx, o.vy);
    ctx.globalAlpha = clamp(sp / 2400, 0, .85);
    const ang = Math.atan2(o.vy, o.vx);
    const len = clamp(sp * .12, 90, 260);
    ctx.translate(o.x, o.y); ctx.rotate(ang + Math.PI);
    ctx.drawImage(sprite, -10, -len * .22, len, len * .44);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBall(o) {
  const def = equippedBall();
  const img = IMG[def.sprite] || IMG.ball;
  const d = o.r * 2;
  /* Squash and stretch along the direction of travel, plus a pop as it
     enters play. A rigid circle reads as a sprite; this reads as a ball. */
  const sp = Math.hypot(o.vx, o.vy);
  const stretch = 1 + clamp(sp / 5200, 0, .26);
  const squash = 1 / stretch;
  const travel = Math.atan2(o.vy, o.vx);
  const pop = o.age < .22 ? easeOutBack(clamp(o.age / .22, 0, 1)) : 1;
  const land = o.squash > 0 ? 1 - o.squash * .35 : 1;
  // contact shadow so the ball reads against a busy court
  ctx.save();
  ctx.globalAlpha = .28; ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(o.x + 5, o.y + o.r * .82, o.r * .9, o.r * .32, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // SKILLS: a ball you have been working glows, harder at every level
  const lv = styleLevel(o);
  if (lv > 0) {
    const col = CONFIG.STYLE.COLOURS[lv];
    const puls = 0.6 + 0.4 * Math.sin(G.elapsed * (6 + lv * 2) + o.id);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const ag = ctx.createRadialGradient(o.x, o.y, o.r * .5, o.x, o.y, o.r * (1.7 + lv * .16));
    ag.addColorStop(0, hexA(col, .30 + .06 * lv));
    ag.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1.7 + lv * .16), 0, TAU); ctx.fill();
    ctx.strokeStyle = hexA(col, .55 + .08 * lv);
    ctx.lineWidth = 2 + lv * .7;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 7 + puls * 4, 0, TAU); ctx.stroke();
    ctx.restore();
    if (!o.dying && Math.random() < 0.12 * lv) {
      spawnP({ x: o.x + rand(-o.r, o.r), y: o.y + rand(-o.r, o.r),
        vx: rand(-40, 40), vy: rand(-90, -20), r: rand(2, 4.5),
        life: rand(.25, .5), c: col, g: -40 });
    }
  }

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(pop, pop);
  ctx.rotate(travel);                       // squash along the flight line
  ctx.scale(stretch, squash * land);
  ctx.rotate(-travel);
  ctx.rotate(o.rot);                        // ...then spin the artwork
  if (o.comboCarrier && G.combo > 0) {
    ctx.shadowColor = "rgba(255,200,61,.9)"; ctx.shadowBlur = 26;
  }
  if (def.art) CourtArt.paint(ctx, def.art, -o.r, -o.r, d, d);
  else if (img && img.width) ctx.drawImage(img, -o.r, -o.r, d, d);
  else { ctx.fillStyle = "#e07a2b"; ctx.beginPath(); ctx.arc(0, 0, o.r, 0, TAU); ctx.fill(); }
  ctx.restore();

  // a bright rim-light on the ball your combo is riding on
  if (o.comboCarrier && G.combo > 0 && !o.dying) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 3, -2.5, -0.4); ctx.stroke();
    ctx.restore();
  }

  if (lv > 0 && !o.dying) {
    ctx.save();
    ctx.font = "900 " + (15 + lv) + "px " + FONT;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const label = "x" + styleMult(o).toFixed(1);
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(40,4,12,.85)"; ctx.lineJoin = "round";
    ctx.strokeText(label, o.x, o.y + o.r + 16);
    ctx.fillStyle = CONFIG.STYLE.COLOURS[lv];
    ctx.fillText(label, o.x, o.y + o.r + 16);
    ctx.restore();
  }
  if (o.held) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,244,224,.95)"; ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = -G.elapsed * 60;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 12, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (o.alleyOop) {
    ctx.save();
    ctx.strokeStyle = "rgba(185,140,255,.9)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 9 + Math.sin(G.elapsed * 12) * 3, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

/* The bomb is drawn in code, not from the sheet, precisely so it can
   never be mistaken for a ball: different silhouette, different
   colour, a lit fuse and a pulsing warning ring. */
function drawBomb(o) {
  const r = o.r, pulse = .5 + .5 * Math.sin(G.elapsed * 9 + o.id);
  ctx.save();
  ctx.translate(o.x, o.y);

  // warning ring
  ctx.strokeStyle = "rgba(255,59,92," + (.35 + .45 * pulse) + ")";
  ctx.lineWidth = 4 + pulse * 3;
  ctx.beginPath(); ctx.arc(0, 0, r + 10 + pulse * 5, 0, TAU); ctx.stroke();

  ctx.rotate(o.rot * .35);
  // body
  const g = ctx.createRadialGradient(-r * .32, -r * .38, r * .12, 0, 0, r);
  g.addColorStop(0, "#5a5f6b"); g.addColorStop(.45, "#23262e"); g.addColorStop(1, "#0a0b0f");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = "#07080b";
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  // metal band
  ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, 0, r * .66, .6, 2.3); ctx.stroke();
  // skull marking - the clearest possible "do not dunk me"
  ctx.save();
  ctx.rotate(-o.rot * .35);                       // the skull stays upright
  ctx.fillStyle = "rgba(255,255,255,.93)";
  const sk = r * .44;
  ctx.beginPath(); ctx.arc(0, -sk * .18, sk, 0, TAU); ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-sk * .52, sk * .52, sk * 1.04, sk * .5, sk * .2); ctx.fill();
  ctx.fillStyle = "#0a0b0f";
  ctx.beginPath(); ctx.arc(-sk * .38, -sk * .24, sk * .3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(sk * .38, -sk * .24, sk * .3, 0, TAU); ctx.fill();
  ctx.fillRect(-sk * .12, sk * .18, sk * .24, sk * .3);
  ctx.fillRect(-sk * .34, sk * .6, sk * .16, sk * .34);
  ctx.fillRect(sk * .18, sk * .6, sk * .16, sk * .34);
  ctx.restore();
  // cap
  ctx.fillStyle = "#ffc83d";
  ctx.beginPath(); ctx.roundRect(-r * .26, -r * 1.18, r * .52, r * .38, 5); ctx.fill();
  ctx.strokeStyle = "#8a5c00"; ctx.lineWidth = 3; ctx.stroke();
  // fuse
  ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.16);
  ctx.quadraticCurveTo(r * .42, -r * 1.62, r * .16, -r * 1.86);
  ctx.stroke();
  // spark
  const sr = 6 + pulse * 5;
  ctx.globalCompositeOperation = "lighter";
  const sg = ctx.createRadialGradient(r * .16, -r * 1.9, 1, r * .16, -r * 1.9, sr * 2.2);
  sg.addColorStop(0, "rgba(255,240,180,1)"); sg.addColorStop(.4, "rgba(255,150,40,.85)");
  sg.addColorStop(1, "rgba(255,80,0,0)");
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(r * .16, -r * 1.9, sr * 2.2, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCrown(o) {
  const img = IMG["crown" + o.tier[0].toUpperCase() + o.tier.slice(1)] || IMG.crown;
  const d = o.r * 2.3;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, d * .9);
  const col = o.tier === "gold" ? "255,210,60" : o.tier === "silver" ? "225,235,250" : "225,140,70";
  glow.addColorStop(0, "rgba(" + col + ",.45)"); glow.addColorStop(1, "rgba(" + col + ",0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, d * .9, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.rotate(Math.sin(G.elapsed * 3 + o.id) * .22);
  if (img && img.width) ctx.drawImage(img, -d / 2, -d / 2 * (140 / 163), d, d * (140 / 163));
  ctx.restore();
}

/* ---------- trick callout: big, in the corner, like the original ---- */
const trickCall = { name: "", colour: "#ffd23f", t: 0, life: 1.25 };
function callTrick(name, colour) {
  trickCall.name = name; trickCall.colour = colour || "#ffd23f";
  trickCall.t = trickCall.life;
}
function drawTrickCall(dt) {
  if (trickCall.t <= 0) return;
  trickCall.t -= dt;
  const k = 1 - trickCall.t / trickCall.life;              // 0 -> 1
  const inK = clamp(k / .18, 0, 1);
  const outK = clamp((k - .78) / .22, 0, 1);
  const scale = easeOutBack(inK) * (1 - outK * .25);
  const alpha = 1 - outK;
  const cx = 210, cy = H - 110;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // starburst behind the words
  const spark = IMG.sparkle;
  if (spark && spark.width) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * .85;
    ctx.rotate(k * 1.2);
    const sz = 300;
    ctx.drawImage(spark, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }
  ctx.font = "900 46px " + FONT;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 11; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(60,12,4,.92)";
  ctx.strokeText(trickCall.name, 0, 0);
  const grd = ctx.createLinearGradient(0, -26, 0, 26);
  grd.addColorStop(0, "#fff6d0");
  grd.addColorStop(.55, trickCall.colour);
  grd.addColorStop(1, "#c96a00");
  ctx.fillStyle = grd;
  ctx.fillText(trickCall.name, 0, 0);
  ctx.restore();
}

function drawOvertimeTint() {
  if (!G.overtime) return;
  const a = .10 + .05 * Math.sin(G.elapsed * 5);
  ctx.fillStyle = "rgba(255,200,61," + a + ")";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = .9;
  ctx.font = "900 26px " + FONT;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 8; ctx.strokeStyle = "rgba(60,20,0,.8)"; ctx.lineJoin = "round";
  const txt = "OVERTIME  " + Math.ceil(G.overtimeT);
  ctx.strokeText(txt, W / 2, 210); ctx.fillStyle = "#ffd23f"; ctx.fillText(txt, W / 2, 210);
  ctx.restore();
}

/* ==================================================================
   18. HUD
   ================================================================== */
const SCREENS = ["scTitle","scModes","scCrew","scStore","scScores","scPause","scResults"];
let currentScreen = "scTitle";
function showScreen(id) {
  for (const s of SCREENS) { $(s).classList.toggle("on", s === id); $(s).inert = s !== id; }
  currentScreen = id;
  if (id) Sound.click();
  if(id) requestAnimationFrame(()=>$(id).querySelector('button')?.focus({preventScroll:true}));
}
function showHUD(on) { $("hud").classList.toggle("on", !!on); $("hud").inert=!on; }

function updateHUD() {
  const sc = $("score");
  const txt = fmt(G.score);
  if (sc.textContent !== txt) sc.textContent = txt;
  $("crownTxt").textContent = fmt(SAVE.crowns);

  $("bestLine").textContent = "BEST " + fmt(SAVE.best[G.mode] || 0);

  const wrap = $("comboWrap"), line = $("comboLine");
  if (G.combo > 0) {
    const hot = G.mult >= 4;
    wrap.classList.add("on"); wrap.classList.toggle("hot", hot);
    line.classList.add("on"); line.classList.toggle("hot", hot);
    line.textContent = "x" + G.combo + " COMBO";
    $("comboFill").style.width = (clamp(G.comboT / comboWindow(), 0, 1) * 100) + "%";
  } else { wrap.classList.remove("on", "hot"); line.classList.remove("on", "hot"); }

  // the clock reads m:ss:cc in Time Attack, like the original
  const md = CONFIG.MODES[G.mode], tm = $("timer"), lab = $("timeLabel");
  if (md.seconds > 0) {
    const t = Math.max(0, G.timeLeft);
    const mm = Math.floor(t / 60), ss = Math.floor(t % 60), cc = Math.floor((t * 100) % 100);
    tm.textContent = mm + ":" + String(ss).padStart(2, "0") + ":" + String(cc).padStart(2, "0");
    tm.classList.toggle("low", t <= 10);
  } else {
    tm.textContent = G.dunks + " DUNKS";
    tm.classList.remove("low");
  }
}
let bumpT1 = 0, bumpT2 = 0;
function bumpScore() {
  const el = $("score"); el.classList.add("bump");
  clearTimeout(bumpT1); bumpT1 = setTimeout(() => el.classList.remove("bump"), 140);
}
function bumpCrowns() {
  const el = $("crownChip"); el.classList.add("bump");
  clearTimeout(bumpT2); bumpT2 = setTimeout(() => el.classList.remove("bump"), 140);
}
function updateLivesUI() {
  const box = $("lives"); box.innerHTML = "";
  if (G.maxLives <= 0) return;
  for (let i = 0; i < G.maxLives; i++) {
    const img = document.createElement("img");
    img.src = "assets/ui/heart.webp";
    if (i >= G.lives) img.className = "gone";
    box.appendChild(img);
  }
}

/* companion button: charge ring + icon + active countdown */
function updateHelperUI() {
  const c = $("helperCv"), g = c.getContext("2d"), S = c.width;
  const h = equippedHelper();
  const full = G.helperMeter >= CONFIG.HELPER.METER_MAX;
  g.clearRect(0, 0, S, S);

  g.fillStyle = "rgba(10,5,10,.6)";
  g.beginPath(); g.arc(S / 2, S / 2, S * .42, 0, TAU); g.fill();
  g.strokeStyle = "rgba(255,244,224,.22)"; g.lineWidth = 9;
  g.beginPath(); g.arc(S / 2, S / 2, S * .40, 0, TAU); g.stroke();

  const frac = G.helperActive ? (G.helperT / h.dur) : (G.helperMeter / CONFIG.HELPER.METER_MAX);
  g.strokeStyle = G.helperActive ? "#8ef5a0" : (full ? "#ffd23f" : h.colour);
  g.lineWidth = 9; g.lineCap = "round";
  g.beginPath(); g.arc(S / 2, S / 2, S * .40, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(frac, 0, 1)); g.stroke();

  const img = IMG[h.icon];
  if (img && img.width) {
    const s = S * .47, ar = img.height / img.width;
    g.globalAlpha = full || G.helperActive ? 1 : .5;
    g.drawImage(img, S / 2 - s / 2, S / 2 - s * ar / 2, s, s * ar);
    g.globalAlpha = 1;
  }
  if (!full && !G.helperActive) {
    g.fillStyle = "rgba(255,244,224,.85)"; g.font = "900 " + Math.round(S * .14) + "px " + FONT;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(Math.floor(G.helperMeter) + "%", S / 2, S / 2 + S * .27);
  }
  $("helperBtn").classList.toggle("ready", full && !G.helperActive);
  $("helperBtn").classList.toggle("spent", !full && !G.helperActive);
}

let coachT = 0;
function coach() {
  $("coach").classList.add("on");
  clearTimeout(coachT); coachT = setTimeout(hideCoach, 5200);
}
function hideCoach() { $("coach").classList.remove("on"); }

function toast(imgSrc, title, sub) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = '<img alt=""><span><span class="tt"></span><span class="ts"></span></span>';
  el.querySelector("img").src = imgSrc;
  el.querySelector(".tt").textContent = title;
  el.querySelector(".ts").textContent = sub;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 2900);
}

/* ==================================================================
   19. MODAL CARDS (rank ups + trick tuition)
   ================================================================== */
const modalQueue = [];
function pushCard(c) { modalQueue.push(c); }
function showNextCard() {
  if (!modalQueue.length) { $("modal").classList.remove("on"); return; }
  const c = modalQueue.shift();
  $("modalImg").src = c.img;
  $("modalKicker").textContent = c.kicker;
  $("modalTitle").textContent = c.title;
  $("modalBody").textContent = c.body;
  $("modalReward").innerHTML = c.reward
    ? '<img src="assets/ui/coin.webp" alt=""><span>+' + c.reward + ' crowns</span>' : "";
  $("modal").classList.add("on");
  if (c.sound) Sound.rankUp();
}
function queueRankCards(from, to) {
  for (let r = from + 1; r <= to; r++) {
    SAVE.crowns += CONFIG.CROWNS.RANK_UP;
    pushCard({
      img: "assets/ui/trophy.webp",
      kicker: "Rank up",
      title: "Rank " + r + " · " + rankName(r),
      body: "Every rank adds a permanent +1% to your score. You are now on " +
            Math.round(rankMult() * 100) + "% of base.",
      reward: CONFIG.CROWNS.RANK_UP,
      sound: true
    });
  }
  saveNow();
}
/* introduce exactly one new trick per run, so depth keeps unfolding */
function queueTrickCard() {
  const next = TRICKS.find(t => !SAVE.taught.includes(t.id));
  if (!next) return;
  SAVE.taught.push(next.id);
  saveNow();
  pushCard({
    img: "assets/obj/sparkle.webp",
    kicker: "New trick",
    title: next.name,
    body: next.teach + "  Worth " + next.pts + " bonus points.",
    reward: 0
  });
}

/* ==================================================================
   20. RESULTS
   ================================================================== */
function buildResults(reason) {
  const titles = { time: "Final buzzer", bomb: "Blown up", quit: "Walked off" };
  $("resTitle").textContent = titles[reason] || "Run over";
  const good = G.score >= (SAVE.best[G.mode] || 0) * .75 && G.dunks > 0;
  $("resImg").src = good ? "assets/player/celebrate.webp" : "assets/player/dejected.webp";
  $("resWho").textContent = (SAVE.name || CONFIG.PLAYER.NAME) + " · #" + CONFIG.PLAYER.NUMBER;
  $("resScore").textContent = fmt(G.score);
  $("resBest").innerHTML = G.newBest
    ? '<div class="newbest">New personal best</div>'
    : '<div class="sub">Best ' + fmt(SAVE.best[G.mode] || 0) + '</div>';
  $("stDunks").textContent = G.dunks;
  $("stBest").textContent = "x" + Math.min(1 + Math.floor(G.bestCombo / CONFIG.COMBO.MULT_STEP), multCap());
  $("stTricks").textContent = G.tricks;
  $("stCrowns").textContent = Math.round(G.crownsRun);
  if (G.newBest || good) Sound.cheer(1.6);
  queueTrickCard();
  setTimeout(showNextCard, 700);
}

function shareText() {
  const names = { time: "Time Attack", arcade: "Arcade", sudden: "Sudden Death" };
  const L = [];
  L.push("👑 " + CONFIG.GAME_NAME);
  L.push((SAVE.name || "YOU") + " #" + CONFIG.PLAYER.NUMBER + " — " + fmt(G.score) + " (" + names[G.mode] + ")");
  L.push(G.dunks + " dunks · " + G.tricks + " tricks · best chain " + G.bestCombo);
  if (G.overtimesThisRun) L.push("⚡ " + G.overtimesThisRun + "x OVERTIME");
  if (G.newBest) L.push("⭐ New personal best");
  L.push("Rank " + SAVE.rank + " · " + rankName(SAVE.rank));
  L.push('"' + CONFIG.TAGLINE + '"');
  return L.join("\n");
}
async function copyShare() {
  const txt = shareText();
  let ok = false;
  try { await navigator.clipboard.writeText(txt); ok = true; }
  catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove();
    } catch (e2) { ok = false; }
  }
  Sound.click(); haptic(12);
  toast("assets/ui/coin.webp", ok ? "Copied" : "Copy failed", ok ? "Paste it anywhere" : "Select and copy by hand");
}

/* ==================================================================
   21. STORE + CREW
   ================================================================== */
let storeTab = "balls";
function storeData() {
  if (storeTab === "balls") return { items: BALLS, owned: SAVE.ownedBalls, eq: SAVE.ball, kind: "ball" };
  if (storeTab === "courts") return { items: COURTS, owned: SAVE.ownedCourts, eq: SAVE.court, kind: "court" };
  return { items: HELPERS, owned: SAVE.ownedHelpers, eq: SAVE.helper, kind: "helper" };
}
function itemImage(it, kind) {
  if (kind === "ball") return "assets/obj/" + it.sprite + ".webp";
  if (kind === "court") return ASSETS[it.img];
  return ASSETS[it.icon];
}
function renderStore() {
  $("storeCrowns").textContent = fmt(SAVE.crowns);
  const { items, owned, eq, kind } = storeData();
  const grid = $("storeGrid");
  grid.innerHTML = "";
  grid.classList.toggle('court-grid', kind === 'court');
  for (const it of items) {
    const has = owned.includes(it.id), isEq = eq === it.id;
    const card = document.createElement("button");
    card.type = 'button'; card.setAttribute('aria-pressed',String(isEq));
    card.className = "card" + (has ? " owned" : "") + (isEq ? " equipped" : "");
    card.innerHTML =
      '<img alt="">' +
      '<div class="cn"></div><div class="cs"></div>' +
      '<div class="cp"></div>';
    card.querySelector("img").src = itemImage(it, kind);
    if(kind==='ball' && it.art) card.querySelector('img').replaceWith(CourtArt.canvas(it.art));
    if(kind==='court') {
      const preview=document.createElement('canvas');preview.width=280;preview.height=110;
      preview.style.cssText='width:100%;height:110px;border-radius:8px';
      const im=IMG.courtsAtlas;
      if(im?.naturalWidth)preview.getContext('2d').drawImage(im,0,[0,344,686][it.panel],1536,337,0,0,280,110);
      card.querySelector('img').replaceWith(preview);
    }
    card.querySelector(".cn").textContent = it.name;
    card.querySelector(".cs").textContent = it.blurb;
    const cp = card.querySelector(".cp");
    if (isEq) { cp.className = "cp eq"; cp.textContent = "EQUIPPED"; }
    else if (has) cp.textContent = "TAP TO EQUIP";
    else cp.innerHTML = '<img src="assets/ui/coin.webp" alt="">' + it.price;
    card.onclick = () => buyOrEquip(it, kind, has, isEq);
    grid.appendChild(card);
  }
}
function buyOrEquip(it, kind, has, isEq) {
  if (isEq) return;
  const ownedList = kind === "ball" ? SAVE.ownedBalls : kind === "court" ? SAVE.ownedCourts : SAVE.ownedHelpers;
  if (!has) {
    if (SAVE.crowns < it.price) {
      Sound.fail(); haptic(30);
      toast("assets/ui/coin.webp", "Not enough crowns", "You need " + (it.price - SAVE.crowns) + " more");
      return;
    }
    SAVE.crowns -= it.price;
    ownedList.push(it.id);
    Sound.buy(); haptic([10, 28, 10]);
    toast(itemImage(it, kind), "Unlocked " + it.name, "-" + it.price + " crowns");
  } else { Sound.click(); haptic(8); }
  if (kind === "ball") SAVE.ball = it.id;
  else if (kind === "court") SAVE.court = it.id;
  else SAVE.helper = it.id;
  saveNow(); renderStore(); renderCrew();
}
function renderCrew() {
  const grid = $("crewGrid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const h of HELPERS) {
    const has = SAVE.ownedHelpers.includes(h.id), isEq = SAVE.helper === h.id;
    const card = document.createElement("button");
    card.type = 'button'; card.setAttribute('aria-pressed',String(isEq));
    card.className = "card" + (has ? " owned" : "") + (isEq ? " equipped" : "");
    card.innerHTML = '<img alt=""><div class="cn"></div><div class="cs"></div><div class="cp"></div>';
    card.querySelector("img").src = ASSETS[h.icon];
    card.querySelector(".cn").textContent = h.name;
    card.querySelector(".cs").textContent = h.long;
    const cp = card.querySelector(".cp");
    if (isEq) { cp.className = "cp eq"; cp.textContent = "PICKED"; }
    else if (has) cp.textContent = "TAP TO PICK";
    else cp.innerHTML = '<img src="assets/ui/coin.webp" alt="">' + h.price;
    card.onclick = () => {
      if (!has) { Sound.fail(); toast("assets/ui/coin.webp", "Locked", "Buy " + h.name + " in the store"); return; }
      SAVE.helper = h.id; saveNow(); renderCrew(); updateHelperUI(); Sound.click();
    };
    grid.appendChild(card);
  }
}
function renderScores() {
  const list = $("scoreList");
  list.innerHTML = "";
  if (!SAVE.scores.length) {
    list.innerHTML = '<div class="li"><span class="nm" style="color:#b09aa4;font-weight:700">No runs yet. Go take one.</span></div>';
    return;
  }
  const names = { time: "Time", arcade: "Arcade", sudden: "Sudden" };
  SAVE.scores.forEach((s, i) => {
    const el = document.createElement("div");
    el.className = "li" + (s.name === SAVE.name ? " me" : "");
    el.innerHTML = '<span class="rk"></span><span class="nm"></span><span class="md"></span><span class="sc"></span>';
    el.querySelector(".rk").textContent = i + 1;
    el.querySelector(".nm").textContent = s.name;
    el.querySelector(".md").textContent = names[s.mode] || s.mode;
    el.querySelector(".sc").textContent = fmt(s.score);
    list.appendChild(el);
  });
}
function renderRankBar() {
  const cur = xpForRank(SAVE.rank), next = xpForRank(SAVE.rank + 1);
  const into = Math.max(0, SAVE.xp - cur), need = Math.max(1, next - cur);
  const frac = clamp(into / need, 0, 1);
  $("rankName").textContent = "Rank " + SAVE.rank + " · " + rankName(SAVE.rank);
  $("rankXp").textContent = fmt(into) + " / " + fmt(need);
  $("rankFill").style.width = (frac * 100) + "%";
}
function renderBests() {
  $("bestTime").textContent = SAVE.best.time ? "BEST " + fmt(SAVE.best.time) : "";
  $("bestArcade").textContent = SAVE.best.arcade ? "BEST " + fmt(SAVE.best.arcade) : "";
  $("bestSudden").textContent = SAVE.best.sudden ? "BEST " + fmt(SAVE.best.sudden) : "";
}

/* ==================================================================
   22. FLOW + WIRING
   ================================================================== */
let pendingMode = "time";
function pause() {
  if (G.state !== ST.PLAY) return;
  releaseGrab();
  G.state = ST.PAUSED;
  stroke.active = false;
  Sound.ambience(false);
  showScreen("scPause");
}
function resume() {
  if (G.state !== ST.PAUSED) return;
  if (glRenderer?.lost) return;
  G.state = ST.PLAY;
  showScreen(null);
  Sound.ambience(true);
  last = performance.now();
}
function quitToMenu() {
  G.state = ST.MENU; G.ended = true;
  objs.length = 0; P.length = 0; POPS.length = 0;
  showHUD(false); Sound.ambience(false);
  renderRankBar(); renderBests();
  showScreen("scTitle");
}

$("btnPlay").onclick = () => { Sound.init(); Sound.resume(); renderBests(); showScreen("scModes"); };
$("btnStore").onclick = () => { renderStore(); showScreen("scStore"); };
$("btnScores").onclick = () => { renderScores(); showScreen("scScores"); };
document.querySelectorAll("[data-back]").forEach(b => b.onclick = () => showScreen(b.dataset.back));
document.querySelectorAll(".mode").forEach(b => b.onclick = () => {
  pendingMode = b.dataset.mode; renderCrew(); showScreen("scCrew");
  $('crewSubtitle').textContent = b.querySelector('b').textContent + ' · Choose a boost. Charge it with every dunk.';
});
$("btnTipoff").onclick = () => startRun(pendingMode);
document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
  storeTab = t.dataset.tab; renderStore(); Sound.click();
});
$("btnPause").onclick = pause;
$("btnResume").onclick = resume;
$("btnRestart").onclick = () => startRun(G.mode);
$("btnQuit").onclick = quitToMenu;
$("btnAgain").onclick = () => startRun(G.mode);
$("btnMenu").onclick = quitToMenu;
$("btnShare").onclick = copyShare;
$("btnWipe").onclick = () => { SAVE.scores = []; saveNow(); renderScores(); toast("assets/ui/trophy.webp", "Board cleared", "Fresh start"); };
$("modalOk").onclick = () => { Sound.click(); showNextCard(); };
$("helperBtn").onclick = useHelper;
$("helperBtn").addEventListener("pointerdown", e => e.stopPropagation());

function setMute(m) {
  SAVE.muted = m; Sound.setMuted(m); saveNow();
  const ic = m ? "🔇" : "🔊";
  $("btnMute").textContent = ic; $("btnMute2").textContent = ic;
  for(const id of ['btnMute','btnMute2']) $(id).setAttribute('aria-label',m?'Enable sound':'Mute sound');
}
$("btnMute").onclick = () => { Sound.init(); setMute(!SAVE.muted); Sound.click(); };
$("btnMute2").onclick = () => { setMute(!SAVE.muted); Sound.click(); };
$('btnHow').onclick = () => { $('howDialog').showModal(); Sound.click(); };
$('btnCloseHow').onclick = () => { $('howDialog').close(); $('btnHow').focus(); };

const nameIn = $("nameInput");
nameIn.oninput = () => {
  SAVE.name = (nameIn.value || "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 8) || "YOU";
  nameIn.value = SAVE.name; save();
};
nameIn.onblur = () => { if (!nameIn.value) { nameIn.value = "YOU"; SAVE.name = "YOU"; saveNow(); } };

cv.addEventListener("pointerdown", onDown, { passive: false });
cv.addEventListener('webglcontextlost', () => {
  if (G.state===ST.PLAY) pause();
  $('rendererLabel').textContent='Graphics paused — restoring WebGL…';
  $('graphicsStatus').textContent='Restoring graphics. Please wait before resuming.';
});
cv.addEventListener('webglcontextrestored', () => {
  $('rendererLabel').textContent=glRenderer?.lost?'Graphics recovery failed — reload to retry':'WEBGL · GPU';
  $('graphicsStatus').textContent=glRenderer?.lost?'Graphics recovery failed. Reload the page to retry.':'';
  last=performance.now();
});
window.addEventListener("pointermove", onMove, { passive: false });
window.addEventListener("pointerup", onUp, { passive: false });
window.addEventListener("pointercancel", e => {
  if(e.pointerId!==stroke.id)return;
  if(stroke.grab){stroke.grab.held=false;stroke.grab.vx=0;stroke.grab.vy=0;}
  stroke.grab=null;stroke.active=false;stroke.id=null;stroke.pts=[];
});
window.addEventListener("keydown", e => {
  if(e.target?.tagName==='INPUT' || $('howDialog').open)return;
  if (e.key === "Escape" || e.key === "p") { G.state === ST.PAUSED ? resume() : pause(); }
  if (e.key === " ") { e.preventDefault(); useHelper(); }
  if (e.key === "m") setMute(!SAVE.muted);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && G.state === ST.PLAY) pause();
  last = performance.now();
});

/* ==================================================================
   23. LOOP
   ================================================================== */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > .05) dt = .05;
  ensureSized();
  lastDt = dt;
  if (!glRenderer?.lost) update(dt);
  draw();
}

/* ==================================================================
   24. BOOT
   ================================================================== */
async function boot() {
  resize();
  await CourtArt.ready;
  await loadAssets(p => { $("loadFill").style.width = (p * 100) + "%"; });
  resize();
  setMute(SAVE.muted);
  nameIn.value = SAVE.name || CONFIG.PLAYER.NAME;
  renderRankBar(); renderBests(); renderCrew(); updateHelperUI();
  G.state = ST.MENU;
  showHUD(false);
  showScreen('scTitle');
  $('rendererLabel').textContent=glRenderer?'WEBGL · GPU':'CANVAS · COMPATIBILITY MODE';
  $("loader").classList.add("gone");
  setTimeout(() => $("loader").remove(), 600);
  last = performance.now();
  requestAnimationFrame(frame);

  // ?nosw=1 skips the service worker, so a dev reload always gets fresh code
  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !location.search.includes("nosw")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  const unlock = () => { Sound.init(); Sound.resume(); window.removeEventListener("pointerdown", unlock); };
  window.addEventListener("pointerdown", unlock);
}
boot();
