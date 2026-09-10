import { describe, expect, it } from "vitest";
import { ExpressionBaselineTracker, type ExpressionScores } from "@/lib/gestures/facialExpressions";

const neutral: ExpressionScores = {
  smile: 0.1,
  frown: 0.05,
  browDown: 0.05,
  browInnerUp: 0.05,
  jawOpen: 0.02,
  eyeWide: 0.05,
  blink: 0.05,
};

/** Feeds `count` frames of `scores` through the tracker and returns the last
 *  classification. The tracker has two deliberately slow stages (a fast EMA
 *  smoothing filter, then a hysteresis streak requirement) that only settle
 *  after several repeated frames — a single call is not representative of
 *  how it behaves live, so tests always feed a run of frames like the real
 *  detection loop does. */
function feed(tracker: ExpressionBaselineTracker, scores: ExpressionScores, count: number) {
  let last: ReturnType<ExpressionBaselineTracker["classify"]> = "none";
  for (let i = 0; i < count; i++) {
    last = tracker.classify(scores);
  }
  return last;
}

describe("ExpressionBaselineTracker", () => {
  it("stays 'none' on a perfectly still neutral face", () => {
    const tracker = new ExpressionBaselineTracker();
    expect(feed(tracker, neutral, 30)).toBe("none");
  });

  it("ignores small frame-to-frame jitter around neutral", () => {
    // Regression test for the bug found this session: classifying straight
    // off raw per-frame scores let ordinary sensor/model noise alone cross
    // the (very small) delta thresholds and flip the badge with no real
    // expression change. A few frames of small alternating jitter should
    // never produce anything but "none".
    const tracker = new ExpressionBaselineTracker();
    feed(tracker, neutral, 10);
    const jitterUp: ExpressionScores = { ...neutral, smile: neutral.smile + 0.02 };
    const jitterDown: ExpressionScores = { ...neutral, smile: neutral.smile - 0.02 };
    let sawNonNone = false;
    for (let i = 0; i < 20; i++) {
      const result = tracker.classify(i % 2 === 0 ? jitterUp : jitterDown);
      if (result !== "none") sawNonNone = true;
    }
    expect(sawNonNone).toBe(false);
  });

  it("detects a held smile", () => {
    const tracker = new ExpressionBaselineTracker();
    feed(tracker, neutral, 10);
    const smiling: ExpressionScores = { ...neutral, smile: neutral.smile + 0.25 };
    expect(feed(tracker, smiling, 20)).toBe("smile");
  });

  it("detects a held sad expression", () => {
    const tracker = new ExpressionBaselineTracker();
    feed(tracker, neutral, 10);
    const sad: ExpressionScores = { ...neutral, frown: neutral.frown + 0.2 };
    expect(feed(tracker, sad, 20)).toBe("sad");
  });

  it("detects a held angry expression", () => {
    const tracker = new ExpressionBaselineTracker();
    feed(tracker, neutral, 10);
    const angry: ExpressionScores = { ...neutral, browDown: neutral.browDown + 0.25 };
    expect(feed(tracker, angry, 20)).toBe("angry");
  });

  it("detects a held surprised expression", () => {
    const tracker = new ExpressionBaselineTracker();
    feed(tracker, neutral, 10);
    const surprised: ExpressionScores = {
      ...neutral,
      browInnerUp: neutral.browInnerUp + 0.25,
      jawOpen: neutral.jawOpen + 0.2,
      eyeWide: neutral.eyeWide + 0.15,
    };
    expect(feed(tracker, surprised, 20)).toBe("surprised");
  });

  it("detects a blink from the raw score without needing a baseline", () => {
    const tracker = new ExpressionBaselineTracker();
    feed(tracker, neutral, 10);
    const blinking: ExpressionScores = { ...neutral, blink: 0.9 };
    expect(feed(tracker, blinking, 5)).toBe("blink");
  });

  it("resets its learned baseline and hysteresis state", () => {
    const tracker = new ExpressionBaselineTracker();
    feed(tracker, neutral, 10);
    const smiling: ExpressionScores = { ...neutral, smile: neutral.smile + 0.25 };
    feed(tracker, smiling, 20);
    tracker.reset();
    // Right after a reset the tracker has no baseline yet, so even a
    // dramatically different first frame must read as "none" rather than
    // immediately re-triggering the previous classification.
    expect(tracker.classify(smiling)).toBe("none");
  });

  it("adapts its baseline to a different resting face over time", () => {
    // A face with a naturally different resting mouth-corner score should
    // settle back to "none" once treated as the new neutral, instead of
    // permanently reading as "smiling" — this is the whole point of a
    // baseline instead of a fixed absolute threshold.
    const tracker = new ExpressionBaselineTracker();
    const differentRestingFace: ExpressionScores = { ...neutral, smile: 0.35 };
    expect(feed(tracker, differentRestingFace, 200)).toBe("none");
  });
});
