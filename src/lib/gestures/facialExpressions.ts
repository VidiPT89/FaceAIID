export type FacialExpression =
  | "smile"
  | "laugh"
  | "sad"
  | "surprised"
  | "angry"
  | "kiss"
  | "cheekPuff"
  | "mouthOpen"
  | "browsRaised"
  | "wink"
  | "blink"
  | "none";

interface Blendshape {
  categoryName: string;
  score: number;
}

export interface ExpressionScores {
  smile: number;
  frown: number;
  browDown: number;
  browInnerUp: number;
  jawOpen: number;
  eyeWide: number;
  /** Both eyes closed: the less-closed eye's score. */
  blink: number;
  /** One eye closed: the more-closed eye's score (with `blink` for the other). */
  blinkMax: number;
  browOuterUp: number;
  pucker: number;
  cheekPuff: number;
}

function score(blendshapes: Blendshape[], name: string): number {
  return blendshapes.find((b) => b.categoryName === name)?.score ?? 0;
}

export function computeExpressionScores(blendshapes: Blendshape[]): ExpressionScores {
  const smileL = score(blendshapes, "mouthSmileLeft");
  const smileR = score(blendshapes, "mouthSmileRight");
  const frownL = score(blendshapes, "mouthFrownLeft");
  const frownR = score(blendshapes, "mouthFrownRight");
  const browDownL = score(blendshapes, "browDownLeft");
  const browDownR = score(blendshapes, "browDownRight");
  const eyeWideL = score(blendshapes, "eyeWideLeft");
  const eyeWideR = score(blendshapes, "eyeWideRight");
  const eyeBlinkL = score(blendshapes, "eyeBlinkLeft");
  const eyeBlinkR = score(blendshapes, "eyeBlinkRight");

  return {
    smile: Math.max(smileL, smileR),
    frown: Math.max(frownL, frownR),
    browDown: (browDownL + browDownR) / 2,
    browInnerUp: score(blendshapes, "browInnerUp"),
    jawOpen: score(blendshapes, "jawOpen"),
    eyeWide: Math.max(eyeWideL, eyeWideR),
    blink: Math.min(eyeBlinkL, eyeBlinkR),
    blinkMax: Math.max(eyeBlinkL, eyeBlinkR),
    browOuterUp: (score(blendshapes, "browOuterUpLeft") + score(blendshapes, "browOuterUpRight")) / 2,
    pucker: score(blendshapes, "mouthPucker"),
    cheekPuff: score(blendshapes, "cheekPuff"),
  };
}

/**
 * Classifies expression by how far the current frame's blendshape scores
 * deviate from a slow-moving "neutral face" baseline, instead of comparing
 * to fixed absolute thresholds.
 *
 * Fixed thresholds don't generalize well here: MediaPipe's blendshape
 * scores for a natural (not exaggerated) expression already sit at very
 * different resting values from one face to the next (a naturally
 * downturned mouth corner can score `mouthFrownLeft` non-trivially even at
 * rest, for example) — a threshold loose enough for one face is often
 * already past another face's neutral baseline. This tracks each session's
 * own neutral face live and classifies relative to it, the same fix already
 * applied to the native (Vision-based) classifier.
 */
export class ExpressionBaselineTracker {
  private baseline: ExpressionScores | null = null;
  /** A fast-moving average of the raw scores, recomputed every frame.
   *  Blendshape scores still jitter a little frame-to-frame even on a
   *  still, neutral face; smoothing first keeps that jitter from crossing
   *  the delta thresholds below on its own. */
  private smoothed: ExpressionScores | null = null;
  private readonly smoothRate = 0.35;
  /** Slow enough that holding an expression doesn't erase its own signal
   *  by getting absorbed into the baseline; fast enough to track real
   *  drift (lighting, camera angle, a different person) within seconds. */
  private readonly adaptRate = 0.02;
  /** A much slower adaptation rate applied even while an expression is
   *  currently displayed. Without this, a face whose natural resting
   *  asymmetry sits just past one of the thresholds below (many real faces
   *  aren't perfectly symmetric) could get permanently stuck showing that
   *  expression: once displayed is non-none the baseline stopped updating
   *  entirely, so it never had a chance to learn that this *was* the
   *  neutral face all along. Adapting 20x slower here still lets a held
   *  expression register normally for as long as someone actually holds
   *  it, but a trait that never goes away eventually gets absorbed into
   *  the baseline instead of reporting a permanent false expression (about
   *  200-250 frames, ~7-8 seconds at 30fps, to fully absorb a typical
   *  threshold-sized deviation — fast enough to not leave someone mislabeled
   *  for long, slow enough that a genuinely held few-second expression
   *  doesn't get erased mid-hold). */
  private readonly slowAdaptRate = 0.004;

  /** Hysteresis on top of the per-frame classification: the displayed
   *  expression is the most common result over the last few frames instead
   *  of the raw per-frame value.
   *
   *  An earlier version required a classification to repeat for 3
   *  *consecutive* frames before it could be displayed — that turned out to
   *  be a real bug, not just an over-cautious setting: a real held
   *  expression is never perfectly stable frame-to-frame even after
   *  smoothing (an occasional frame reads as "none" as the mouth/eyes move
   *  slightly), and any single outlier frame reset the whole streak back to
   *  zero. In practice this meant a genuinely held expression could stay
   *  stuck showing "none" indefinitely. A small majority vote tolerates
   *  that kind of one-off noise instead of being wiped out by it. */
  private recentWindow: FacialExpression[] = [];
  private readonly windowSize = 5;
  private readonly requiredVotes = 3;

  reset() {
    this.baseline = null;
    this.smoothed = null;
    this.recentWindow = [];
  }

  classify(scores: ExpressionScores): FacialExpression {
    const previousSmoothed = this.smoothed;
    const base = this.baseline;
    if (!previousSmoothed || !base) {
      // First frame after (re)starting: nothing to compare against yet.
      this.smoothed = scores;
      this.baseline = scores;
      return "none";
    }

    const smooth = (key: keyof ExpressionScores) =>
      previousSmoothed[key] + (scores[key] - previousSmoothed[key]) * this.smoothRate;
    const s: ExpressionScores = {
      smile: smooth("smile"),
      frown: smooth("frown"),
      browDown: smooth("browDown"),
      browInnerUp: smooth("browInnerUp"),
      browOuterUp: smooth("browOuterUp"),
      jawOpen: smooth("jawOpen"),
      eyeWide: smooth("eyeWide"),
      pucker: smooth("pucker"),
      cheekPuff: smooth("cheekPuff"),
      // Blinks are too brief to smooth; they're read raw (see below).
      blink: scores.blink,
      blinkMax: scores.blinkMax,
    };
    this.smoothed = s;

    const delta = (key: keyof ExpressionScores) => s[key] - base[key];
    const smileDelta = delta("smile");
    const jawOpenDelta = delta("jawOpen");
    const browUpDelta = (delta("browInnerUp") + delta("browOuterUp")) / 2;

    const surprised = delta("browInnerUp") > 0.12 && jawOpenDelta > 0.08 && delta("eyeWide") > 0.06;
    const smiling = smileDelta > 0.1;
    // A real smile squints the eyes and pulls the brows down: MediaPipe's
    // smiling test portraits score browDown 0.81-0.89. Checking "angry"
    // before (or without excluding) a smile reported big smiles as angry.
    const angry = delta("browDown") > 0.12 && jawOpenDelta < 0.08 && !surprised && !smiling;
    const sad = delta("frown") > 0.08 && !surprised && !smiling;
    const kiss = delta("pucker") > 0.35 && !smiling;
    const cheekPuff = delta("cheekPuff") > 0.3;
    const mouthOpen = jawOpenDelta > 0.3 && !smiling && !surprised;
    const browsRaised = browUpDelta > 0.2 && jawOpenDelta < 0.15 && !surprised;
    // Blinks and winks are inherently transient (eyes are open almost all
    // the time), so an absolute threshold on the raw score works — no
    // baseline or smoothing needed.
    const blink = s.blink > 0.4;
    const wink = s.blinkMax > 0.55 && s.blink < 0.25;

    let expression: FacialExpression = "none";
    if (surprised) expression = "surprised";
    else if (smiling) expression = jawOpenDelta > 0.25 ? "laugh" : "smile";
    else if (kiss) expression = "kiss";
    else if (cheekPuff) expression = "cheekPuff";
    else if (angry) expression = "angry";
    else if (sad) expression = "sad";
    else if (mouthOpen) expression = "mouthOpen";
    else if (browsRaised) expression = "browsRaised";
    else if (wink) expression = "wink";
    else if (blink) expression = "blink";

    this.recentWindow.push(expression);
    if (this.recentWindow.length > this.windowSize) {
      this.recentWindow.splice(0, this.recentWindow.length - this.windowSize);
    }

    const voteCounts = new Map<FacialExpression, number>();
    for (const vote of this.recentWindow) {
      voteCounts.set(vote, (voteCounts.get(vote) ?? 0) + 1);
    }
    // Among non-"none" expressions that reach the required vote count, pick
    // the most frequent one — a real expression should dominate its own
    // window even with a little frame-to-frame noise; "none" only wins when
    // nothing else clears the bar.
    let winner: FacialExpression | null = null;
    let winnerVotes = 0;
    for (const [candidate, votes] of voteCounts) {
      if (candidate === "none" || votes < this.requiredVotes) continue;
      if (votes > winnerVotes) {
        winner = candidate;
        winnerVotes = votes;
      }
    }

    // A real blink only lasts 1-2 frames at typical camera framerates — far
    // too brief to ever win a 3-of-5 majority vote. Waiting for the vote
    // window meant blink essentially never displayed at all, no matter how
    // deliberately/slowly someone blinked. It bypasses the vote and displays
    // immediately off the smoothed per-frame signal instead, same as any
    // other instantaneous (rather than held) cue.
    const displayed = expression === "blink" || expression === "wink" ? expression : (winner ?? "none");

    // Freeze the baseline on the *displayed* (post-vote) result, not the
    // raw instant one: an earlier version froze on the raw per-frame value,
    // so an occasional weak/neutral-reading frame in the middle of a
    // genuinely held expression let the baseline creep toward it and, over
    // several such dips, gradually cancel out the real signal — the
    // expression would eventually stop registering even though the face
    // never actually changed. Still adapts (just much slower) even while
    // non-none, so a permanent trait doesn't get stuck reporting a false
    // expression forever — see slowAdaptRate.
    const rate = displayed === "none" ? this.adaptRate : this.slowAdaptRate;
    const next = { ...base };
    for (const key of Object.keys(base) as (keyof ExpressionScores)[]) {
      if (key !== "blink" && key !== "blinkMax") next[key] = base[key] + (s[key] - base[key]) * rate;
    }
    this.baseline = next;

    return displayed;
  }
}
