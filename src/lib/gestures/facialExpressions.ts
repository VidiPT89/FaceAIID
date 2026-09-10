export type FacialExpression = "smile" | "sad" | "surprised" | "angry" | "blink" | "none";

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
  blink: number;
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
    if (!previousSmoothed) {
      this.smoothed = scores;
      this.baseline = scores;
      return "none";
    }

    const s: ExpressionScores = {
      smile: previousSmoothed.smile + (scores.smile - previousSmoothed.smile) * this.smoothRate,
      frown: previousSmoothed.frown + (scores.frown - previousSmoothed.frown) * this.smoothRate,
      browDown: previousSmoothed.browDown + (scores.browDown - previousSmoothed.browDown) * this.smoothRate,
      browInnerUp: previousSmoothed.browInnerUp + (scores.browInnerUp - previousSmoothed.browInnerUp) * this.smoothRate,
      jawOpen: previousSmoothed.jawOpen + (scores.jawOpen - previousSmoothed.jawOpen) * this.smoothRate,
      eyeWide: previousSmoothed.eyeWide + (scores.eyeWide - previousSmoothed.eyeWide) * this.smoothRate,
      blink: scores.blink,
    };
    this.smoothed = s;

    const base = this.baseline;
    if (!base) {
      this.baseline = s;
      return "none";
    }

    const smileDelta = s.smile - base.smile;
    const frownDelta = s.frown - base.frown;
    const browDownDelta = s.browDown - base.browDown;
    const browInnerUpDelta = s.browInnerUp - base.browInnerUp;
    const jawOpenDelta = s.jawOpen - base.jawOpen;
    const eyeWideDelta = s.eyeWide - base.eyeWide;

    const surprised = browInnerUpDelta > 0.12 && jawOpenDelta > 0.08 && eyeWideDelta > 0.06;
    const angry = browDownDelta > 0.12 && jawOpenDelta < 0.08 && !surprised;
    const sad = frownDelta > 0.08 && !surprised;
    const smile = smileDelta > 0.1 && jawOpenDelta < 0.3;
    // Blink is inherently transient (eyes are open almost all the time),
    // so an absolute threshold on the raw score works fine here — no
    // baseline or smoothing needed.
    const blink = s.blink > 0.4;

    let expression: FacialExpression = "none";
    if (surprised) expression = "surprised";
    else if (angry) expression = "angry";
    else if (sad) expression = "sad";
    else if (smile) expression = "smile";
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

    const displayed = winner ?? "none";

    // Freeze the baseline on the *displayed* (post-vote) result, not the
    // raw instant one: an earlier version froze on the raw per-frame value,
    // so an occasional weak/neutral-reading frame in the middle of a
    // genuinely held expression let the baseline creep toward it and, over
    // several such dips, gradually cancel out the real signal — the
    // expression would eventually stop registering even though the face
    // never actually changed.
    if (displayed === "none") {
      this.baseline = {
        smile: base.smile + smileDelta * this.adaptRate,
        frown: base.frown + frownDelta * this.adaptRate,
        browDown: base.browDown + browDownDelta * this.adaptRate,
        browInnerUp: base.browInnerUp + browInnerUpDelta * this.adaptRate,
        jawOpen: base.jawOpen + jawOpenDelta * this.adaptRate,
        eyeWide: base.eyeWide + eyeWideDelta * this.adaptRate,
        blink: base.blink,
      };
    }

    return displayed;
  }
}
