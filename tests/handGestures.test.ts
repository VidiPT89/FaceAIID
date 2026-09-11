import { describe, expect, it } from "vitest";
import { classifyHandGesture, HandGestureStabilizer } from "@/lib/gestures/handGestures";

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

  it("recognizes a peace sign", () => {
    const hand = buildHand({
      ...allCurledUp,
      index: { extended: true },
      middle: { extended: true },
    });
    expect(classifyHandGesture(hand)).toBe("peaceSign");
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
    hand[3] = { x: 0.37, y: 0.63, z: 0 };
    hand[4] = { x: 0.4, y: 0.6, z: 0 };
    hand[5] = mcp.index;
    hand[6] = { x: 0.43, y: 0.63, z: 0 };
    hand[8] = { x: 0.4, y: 0.6, z: 0 };
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
