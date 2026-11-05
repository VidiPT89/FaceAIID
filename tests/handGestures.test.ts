import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  classifyHandGesture,
  correctAspect,
  fuseWithModel,
  HandGestureStabilizer,
  type HandGesture,
} from "@/lib/gestures/handGestures";

interface Point {
  x: number;
  y: number;
  z: number;
}

const wrist: Point = { x: 0.5, y: 0.9, z: 0 };
const mcp = {
  thumb: { x: 0.35, y: 0.68, z: 0 } satisfies Point,
  index: { x: 0.45, y: 0.6, z: 0 } satisfies Point,
  middle: { x: 0.5, y: 0.6, z: 0 } satisfies Point,
  ring: { x: 0.55, y: 0.6, z: 0 } satisfies Point,
  pinky: { x: 0.6, y: 0.62, z: 0 } satisfies Point,
};

function normalize(v: { x: number; y: number }) {
  const m = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / m, y: v.y / m };
}

function addv(a: Point, dir: { x: number; y: number }, s: number): Point {
  return { x: a.x + dir.x * s, y: a.y + dir.y * s, z: 0 };
}

/** A straight line from mcp through pip to tip reads as fully "extended"
 *  (the angle at pip is 180°) regardless of which direction it points. */
function extended(base: Point, dir: { x: number; y: number }, len = 0.12) {
  const u = normalize(dir);
  return { pip: addv(base, u, len), tip: addv(base, u, len * 2) };
}

/** A sharp ~90° bend at pip reads as "curled" (well under both the 140°
 *  and thumb's 120° extension thresholds) regardless of orientation. */
function curled(base: Point, dir: { x: number; y: number }, len = 0.1) {
  const u = normalize(dir);
  const perp = { x: -u.y, y: u.x };
  const pip = addv(base, u, len * 0.4);
  return { pip, tip: addv(pip, perp, len * 0.9) };
}

type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";
interface FingerSpec {
  extended: boolean;
  dir?: { x: number; y: number };
}

const UP = { x: 0, y: -1 };

/** Builds a full 21-point MediaPipe-style hand landmark array from a simple
 *  per-finger spec, so each test case reads as "which fingers are out and
 *  which way" instead of a wall of magic coordinates. */
function buildHand(fingers: Record<FingerName, FingerSpec>): Point[] {
  const points: Point[] = new Array(21).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
  points[0] = wrist;

  const layout: Record<FingerName, { mcpIdx: number; pipIdx: number; tipIdx: number }> = {
    thumb: { mcpIdx: 2, pipIdx: 3, tipIdx: 4 },
    index: { mcpIdx: 5, pipIdx: 6, tipIdx: 8 },
    middle: { mcpIdx: 9, pipIdx: 10, tipIdx: 12 },
    ring: { mcpIdx: 13, pipIdx: 14, tipIdx: 16 },
    pinky: { mcpIdx: 17, pipIdx: 18, tipIdx: 20 },
  };

  (Object.keys(layout) as FingerName[]).forEach((name) => {
    const { mcpIdx, pipIdx, tipIdx } = layout[name];
    const base = mcp[name];
    const spec = fingers[name];
    const dir = spec.dir ?? UP;
    const { pip, tip } = spec.extended ? extended(base, dir) : curled(base, dir);
    points[mcpIdx] = base;
    points[pipIdx] = pip;
    points[tipIdx] = tip;
  });

  return points;
}

const allCurledUp: Record<FingerName, FingerSpec> = {
  thumb: { extended: false },
  index: { extended: false },
  middle: { extended: false },
  ring: { extended: false },
  pinky: { extended: false },
};

describe("classifyHandGesture", () => {
  it("returns none for too few landmarks", () => {
    expect(classifyHandGesture([])).toBe("none");
  });

  it("recognizes an open palm", () => {
    const hand = buildHand({
      ...allCurledUp,
      thumb: { extended: true, dir: { x: -1, y: -0.3 } },
      index: { extended: true },
      middle: { extended: true },
      ring: { extended: true },
      pinky: { extended: true },
    });
    expect(classifyHandGesture(hand)).toBe("openPalm");
  });

  it("recognizes a closed fist", () => {
    const hand = buildHand(allCurledUp);
    expect(classifyHandGesture(hand)).toBe("closedFist");
  });

  it("recognizes thumbs up", () => {
    const hand = buildHand({ ...allCurledUp, thumb: { extended: true, dir: { x: 0, y: -1 } } });
    expect(classifyHandGesture(hand)).toBe("thumbsUp");
  });

  it("recognizes thumbs down", () => {
    const hand = buildHand({ ...allCurledUp, thumb: { extended: true, dir: { x: 0, y: 1 } } });
    expect(classifyHandGesture(hand)).toBe("thumbsDown");
  });

  it("recognizes the fingerspelling letter I", () => {
    const hand = buildHand({ ...allCurledUp, pinky: { extended: true } });
    expect(classifyHandGesture(hand)).toBe("letterI");
  });

  it("recognizes a peace sign (fingers spread)", () => {
    const hand = buildHand({
      ...allCurledUp,
      index: { extended: true, dir: { x: -0.5, y: -1 } },
      middle: { extended: true, dir: { x: 0.5, y: -1 } },
    });
    expect(classifyHandGesture(hand)).toBe("peaceSign");
  });

  it("recognizes the letter U (index and middle held together)", () => {
    const hand = buildHand({ ...allCurledUp, index: { extended: true }, middle: { extended: true } });
    expect(classifyHandGesture(hand)).toBe("letterU");
  });

  it("recognizes crossed fingers", () => {
    const hand = buildHand({
      ...allCurledUp,
      index: { extended: true, dir: { x: 0.6, y: -1 } },
      middle: { extended: true, dir: { x: -0.6, y: -1 } },
    });
    expect(classifyHandGesture(hand)).toBe("fingersCrossed");
  });

  it("recognizes the letter B (four fingers up, thumb folded)", () => {
    const hand = buildHand({
      ...allCurledUp,
      index: { extended: true },
      middle: { extended: true },
      ring: { extended: true },
      pinky: { extended: true },
    });
    expect(classifyHandGesture(hand)).toBe("letterB");
  });

  it("matches nothing when fingers are half-open rather than clearly folded", () => {
    // A relaxed hand: index up, the others bent ~130° (between "extended"
    // and "folded"). This used to read as letters such as L or pointing.
    const hand = buildHand({ ...allCurledUp, thumb: { extended: true, dir: { x: -1, y: 0 } }, index: { extended: true } });
    for (const [mcpIdx, pipIdx, tipIdx] of [[9, 10, 12], [13, 14, 16], [17, 18, 20]]) {
      const base = hand[mcpIdx];
      hand[pipIdx] = { x: base.x, y: base.y - 0.1, z: 0 };
      hand[tipIdx] = { x: base.x + 0.06, y: base.y - 0.17, z: 0 };
    }
    expect(classifyHandGesture(hand)).toBe("none");
  });

  it("recognizes three fingers (W)", () => {
    const hand = buildHand({
      ...allCurledUp,
      index: { extended: true },
      middle: { extended: true },
      ring: { extended: true },
    });
    expect(classifyHandGesture(hand)).toBe("threeFingers");
  });

  it("recognizes pointing", () => {
    const hand = buildHand({ ...allCurledUp, index: { extended: true } });
    expect(classifyHandGesture(hand)).toBe("pointing");
  });

  it("recognizes shaka", () => {
    const hand = buildHand({
      ...allCurledUp,
      thumb: { extended: true, dir: { x: -1, y: 0 } },
      pinky: { extended: true },
    });
    expect(classifyHandGesture(hand)).toBe("shaka");
  });

  it("recognizes rock on / horns", () => {
    const hand = buildHand({
      ...allCurledUp,
      index: { extended: true },
      pinky: { extended: true },
    });
    expect(classifyHandGesture(hand)).toBe("rockOn");
  });

  it("recognizes the ASL/LGP 'I love you' sign", () => {
    const hand = buildHand({
      ...allCurledUp,
      thumb: { extended: true, dir: { x: -1, y: 0 } },
      index: { extended: true },
      pinky: { extended: true },
    });
    expect(classifyHandGesture(hand)).toBe("iLoveYou");
  });

  it("recognizes the fingerspelling letter L", () => {
    const hand = buildHand({
      ...allCurledUp,
      thumb: { extended: true, dir: { x: -1, y: 0 } },
      index: { extended: true },
    });
    expect(classifyHandGesture(hand)).toBe("letterL");
  });

  it("recognizes the fingerspelling letter O", () => {
    // Hand-placed rather than built from the generic helper: the "O" shape
    // needs the thumb and index tips pinched to the same point, which is
    // easier to state directly than to derive from the curl/extend helpers.
    const hand: Point[] = new Array(21).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
    hand[0] = wrist;
    hand[2] = mcp.thumb;
    // The index arcs up and forward, then back to meet the thumb — its tip
    // ends well away from its own knuckle, unlike a fist's folded index.
    hand[3] = { x: 0.36, y: 0.58, z: 0 };
    hand[4] = { x: 0.36, y: 0.47, z: 0 };
    hand[5] = mcp.index;
    hand[6] = { x: 0.43, y: 0.48, z: 0 };
    hand[8] = { x: 0.37, y: 0.47, z: 0 };
    const middle = curled(mcp.middle, UP);
    hand[9] = mcp.middle;
    hand[10] = middle.pip;
    hand[12] = middle.tip;
    const ring = curled(mcp.ring, UP);
    hand[13] = mcp.ring;
    hand[14] = ring.pip;
    hand[16] = ring.tip;
    const pinky = curled(mcp.pinky, UP);
    hand[17] = mcp.pinky;
    hand[18] = pinky.pip;
    hand[20] = pinky.tip;

    expect(classifyHandGesture(hand)).toBe("letterO");
  });

  it("recognizes the fingerspelling letter F", () => {
    // Same thumb-index pinch as "O" above, but middle/ring/pinky extended
    // instead of curled — the pinch is what separates the two.
    const hand: Point[] = new Array(21).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
    hand[0] = wrist;
    hand[2] = mcp.thumb;
    // The index arcs up and forward, then back to meet the thumb — its tip
    // ends well away from its own knuckle, unlike a fist's folded index.
    hand[3] = { x: 0.36, y: 0.58, z: 0 };
    hand[4] = { x: 0.36, y: 0.47, z: 0 };
    hand[5] = mcp.index;
    hand[6] = { x: 0.43, y: 0.48, z: 0 };
    hand[8] = { x: 0.37, y: 0.47, z: 0 };
    const middle = extended(mcp.middle, UP);
    hand[9] = mcp.middle;
    hand[10] = middle.pip;
    hand[12] = middle.tip;
    const ring = extended(mcp.ring, UP);
    hand[13] = mcp.ring;
    hand[14] = ring.pip;
    hand[16] = ring.tip;
    const pinky = extended(mcp.pinky, UP);
    hand[17] = mcp.pinky;
    hand[18] = pinky.pip;
    hand[20] = pinky.tip;

    expect(classifyHandGesture(hand)).toBe("letterF");
  });

  it("recognizes the fingerspelling letter D", () => {
    // Index extended straight up; thumb bent in to touch the middle
    // fingertip (not the index tip, which would otherwise read as
    // "pointing"); ring and pinky curled.
    const hand: Point[] = new Array(21).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
    hand[0] = wrist;
    const index = extended(mcp.index, UP);
    hand[5] = mcp.index;
    hand[6] = index.pip;
    hand[8] = index.tip;
    const middle = curled(mcp.middle, UP);
    hand[9] = mcp.middle;
    hand[10] = middle.pip;
    hand[12] = middle.tip;
    hand[2] = mcp.thumb;
    hand[3] = { x: (mcp.thumb.x + middle.tip.x) / 2, y: (mcp.thumb.y + middle.tip.y) / 2, z: 0 };
    hand[4] = middle.tip;
    const ring = curled(mcp.ring, UP);
    hand[13] = mcp.ring;
    hand[14] = ring.pip;
    hand[16] = ring.tip;
    const pinky = curled(mcp.pinky, UP);
    hand[17] = mcp.pinky;
    hand[18] = pinky.pip;
    hand[20] = pinky.tip;

    expect(classifyHandGesture(hand)).toBe("letterD");
  });

  it("recognizes the fingerspelling letter A", () => {
    const hand = buildHand({ ...allCurledUp, thumb: { extended: true, dir: { x: -1, y: 0 } } });
    expect(classifyHandGesture(hand)).toBe("letterA");
  });
});

describe("HandGestureStabilizer", () => {
  it("stays 'none' until a gesture repeats enough times", () => {
    const stabilizer = new HandGestureStabilizer();
    expect(stabilizer.push("openPalm")).toBe("none");
    expect(stabilizer.push("openPalm")).toBe("none");
    expect(stabilizer.push("openPalm")).toBe("openPalm");
  });

  it("tolerates an occasional misclassified frame in an otherwise held gesture", () => {
    // Regression test for the same class of bug fixed in
    // ExpressionBaselineTracker: showing the raw per-frame classification
    // directly means a single frame where the hand's angle briefly pushes
    // one finger across a threshold flashes the wrong gesture (or "none")
    // before correcting itself. A majority vote over a small window must
    // tolerate that instead of losing the real gesture entirely.
    const stabilizer = new HandGestureStabilizer();
    const sequence: Array<Parameters<HandGestureStabilizer["push"]>[0]> = [
      "openPalm",
      "openPalm",
      "none",
      "openPalm",
      "openPalm",
      "pointing",
      "openPalm",
    ];
    let last: ReturnType<HandGestureStabilizer["push"]> = "none";
    for (const gesture of sequence) {
      last = stabilizer.push(gesture);
    }
    expect(last).toBe("openPalm");
  });

  it("switches to a new gesture once it dominates the window", () => {
    const stabilizer = new HandGestureStabilizer();
    for (let i = 0; i < 5; i++) stabilizer.push("openPalm");
    let last: ReturnType<HandGestureStabilizer["push"]> = "none";
    for (let i = 0; i < 5; i++) last = stabilizer.push("closedFist");
    expect(last).toBe("closedFist");
  });
});

interface RealHand {
  image: string;
  width: number;
  height: number;
  model: { categoryName: string; score: number };
  landmarks: { x: number; y: number; z: number }[];
}

/** Landmarks MediaPipe produced on its own public test photos (see the
 *  fixture's `source`). Synthetic hands only check the rules do what they
 *  say; these check the rules against real hands. */
const realHands: RealHand[] = JSON.parse(
  readFileSync(new URL("./fixtures/mediapipe-real.json", import.meta.url), "utf8"),
).hands;

const expected: Record<string, HandGesture[]> = {
  "fist.jpg": ["closedFist"],
  "pointing_up.jpg": ["pointing"],
  "pointing_up_mirror.jpg": ["pointing"],
  "pointing_up_rotated.jpg": ["pointing"],
  "left_hands.jpg": ["openPalm"],
  "male_full_height_hands.jpg": ["openPalm"],
  "portrait_mirror.jpg": ["openPalm"],
  "portrait_small.jpg": ["openPalm"],
  // One of these two hands is relaxed and half-open: "no answer" is fine,
  // a wrong gesture is not.
  "hand-woman-man.jpg": ["openPalm", "none"],
};

describe("on real MediaPipe landmarks", () => {
  it.each(realHands.map((h, i) => [`${h.image} #${i}`, h] as const))("%s", (_, hand) => {
    const heuristic = classifyHandGesture(correctAspect(hand.landmarks, hand.width / hand.height));
    expect(expected[hand.image]).toContain(fuseWithModel(heuristic, hand.model));
  });
});

describe("fuseWithModel", () => {
  it("trusts a confident model over a conflicting hand-coded letter", () => {
    expect(fuseWithModel("letterO", { categoryName: "Closed_Fist", score: 0.9 })).toBe("closedFist");
  });

  it("keeps a hand-coded refinement of the model's class", () => {
    expect(fuseWithModel("letterU", { categoryName: "Victory", score: 0.9 })).toBe("letterU");
    expect(fuseWithModel("letterB", { categoryName: "Open_Palm", score: 0.8 })).toBe("letterB");
  });

  it("ignores the model when unsure or when it says None", () => {
    expect(fuseWithModel("shaka", { categoryName: "Thumb_Up", score: 0.4 })).toBe("shaka");
    expect(fuseWithModel("openPalm", { categoryName: "None", score: 0.95 })).toBe("openPalm");
    expect(fuseWithModel("rockOn")).toBe("rockOn");
  });
});
