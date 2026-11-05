export type HandGesture =
  | "thumbsUp"
  | "thumbsDown"
  | "openPalm"
  | "closedFist"
  | "peaceSign"
  | "pointing"
  | "threeFingers"
  | "shaka"
  | "iLoveYou"
  | "letterA"
  | "letterD"
  | "letterF"
  | "letterI"
  | "letterL"
  | "letterO"
  | "rockOn"
  | "letterB"
  | "letterU"
  | "fingersCrossed"
  | "none";

interface Point {
  x: number;
  y: number;
  z: number;
}

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 6, 10, 14, 18];
const FINGER_MCPS = [2, 5, 9, 13, 17];

function angleAtVertex(a: Point, vertex: Point, b: Point): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y, z: a.z - vertex.z };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y, z: b.z - vertex.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.hypot(v1.x, v1.y, v1.z);
  const mag2 = Math.hypot(v2.x, v2.y, v2.z);
  if (mag1 === 0 || mag2 === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * A finger is "extended" when it's roughly straight through its middle
 * joint — the angle MCP→PIP→TIP close to 180°. This is robust to the hand
 * being rotated or tilted, unlike a tip-distance-from-wrist check.
 *
 * The thumb gets a looser bar: its joint doesn't straighten as close to
 * 180° even when held straight out (thumbs up, "L", shaka).
 */
const THUMB_EXTEND_ANGLE = 120;
const FINGER_EXTEND_ANGLE = 140;
/** Folded fingers measured 27-65° on MediaPipe's fist and pointing photos;
 *  relaxed half-open ones 125-150°. */
const FINGER_CURLED_ANGLE = 120;
/** "L" needs the thumb clearly straight out, not just loosely extended.
 *  Measured on MediaPipe's pointing_up test image: a natural pointing hand
 *  holds the thumb at ~136-140°, which the looser 120° bar read as "L".
 *  Open-palm thumbs measured 169-177°. */
const THUMB_STRAIGHT_ANGLE = 150;
/** Index/middle fingertip gap (relative to hand size) below which a V is
 *  read as the fingers held together ("U"). */
const FINGERS_TOGETHER_GAP = 0.25;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * MediaPipe normalizes x by the frame's width and y by its height, so on a
 * 16:9 video a horizontal distance reads ~1.8x shorter than the same
 * vertical one — distorting every distance ratio and bent-joint angle the
 * classifier uses. Scaling x (and z, which shares x's scale) by the aspect
 * ratio restores true proportions.
 */
export function correctAspect(landmarks: Point[], aspectRatio: number): Point[] {
  return landmarks.map((p) => ({ x: p.x * aspectRatio, y: p.y, z: p.z * aspectRatio }));
}

/** Position of `p` along the knuckle line (index MCP → pinky MCP), so
 *  fingertip order across the hand can be compared in any hand rotation. */
function acrossPalm(landmarks: Point[], p: Point): number {
  const from = landmarks[5];
  const to = landmarks[17];
  const ax = to.x - from.x;
  const ay = to.y - from.y;
  const len = Math.hypot(ax, ay) || 1;
  return ((p.x - from.x) * ax + (p.y - from.y) * ay) / len;
}

/** Raw numbers behind the thumb/pinch-dependent gestures, exposed for a
 *  debug overlay — the same "show real numbers instead of guessing again"
 *  approach already used for facial expression scores. */
export interface HandDebugInfo {
  thumbAngle: number;
  thumbExtended: boolean;
  pinch: number;
}

export function computeHandDebugInfo(landmarks: Point[]): HandDebugInfo | null {
  if (!landmarks || landmarks.length < 21) return null;
  const thumbAngle = angleAtVertex(landmarks[FINGER_MCPS[0]], landmarks[FINGER_PIPS[0]], landmarks[FINGER_TIPS[0]]);
  const handScale = distance(landmarks[0], landmarks[9]) || 1;
  return {
    thumbAngle,
    thumbExtended: thumbAngle > THUMB_EXTEND_ANGLE,
    pinch: distance(landmarks[4], landmarks[8]) / handScale,
  };
}

/**
 * Classifies a single, static hand shape per frame. This intentionally
 * covers a curated set of shapes that double as ASL/LGP numbers, a couple
 * of common signs (peace/V, W, shaka/Y, "I love you"), and two
 * fingerspelling letters that happen to be static poses (L, O) — it is
 * **not** general sign-language recognition: real sign languages (and most
 * fingerspelling letters, e.g. J or Z) combine hand shape, orientation,
 * movement and non-manual markers (facial expression) over time, which
 * needs a sequence model and training data, not a per-frame geometric
 * heuristic. Framing this as "a handful of recognizable static shapes"
 * rather than "sign language support" avoids promising more than what a
 * single-frame classifier can honestly deliver.
 */
export function classifyHandGesture(landmarks: Point[]): HandGesture {
  if (!landmarks || landmarks.length < 21) return "none";

  const angles = FINGER_TIPS.map((tip, i) => angleAtVertex(landmarks[FINGER_MCPS[i]], landmarks[FINGER_PIPS[i]], landmarks[tip]));
  const [thumbAngle] = angles;
  const thumbExtended = thumbAngle > THUMB_EXTEND_ANGLE;
  // Three states per finger, not two: a relaxed, half-open hand puts
  // fingers at ~125-150° (measured on MediaPipe's hand-woman-man photo),
  // right on the extension bar. Treating "not extended" as "curled" turned
  // such hands into letters (L, D, I…). Shapes that need a finger folded
  // now require it clearly folded; in-between fingers match nothing.
  const [, indexExtended, middleExtended, ringExtended, pinkyExtended] = angles.map((a) => a > FINGER_EXTEND_ANGLE);
  const [, indexCurled, middleCurled, ringCurled, pinkyCurled] = angles.map((a) => a < FINGER_CURLED_ANGLE);
  const nonThumbExtendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;
  const nonThumbCurledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;
  const othersCurled = middleCurled && ringCurled && pinkyCurled;

  // Hand scale (wrist to middle-finger MCP) so distance thresholds below
  // stay correct regardless of how close the hand is to the camera.
  const handScale = distance(landmarks[0], landmarks[9]) || 1;
  const thumbIndexPinch = distance(landmarks[4], landmarks[8]) / handScale;
  const thumbMiddlePinch = distance(landmarks[4], landmarks[12]) / handScale;

  // ASL/LGP "O": thumb and index tips pinched into a circle, the other
  // fingers folded. In a fist the thumb also rests near the index tip
  // (pinch 0.19 on MediaPipe's fist photo), but that index is folded flat
  // against the palm (tip 0.32 from its knuckle); in an "O" it arcs out in
  // front, so the tip has to be well away from its own knuckle.
  const indexArc = distance(landmarks[8], landmarks[5]) / handScale;
  if (thumbIndexPinch < 0.22 && indexArc > 0.45 && indexCurled && othersCurled) {
    return "letterO";
  }

  // ASL/LGP "F" (also the 👌 "OK" sign): thumb and index pinched like "O",
  // but middle/ring/pinky straight out.
  if (thumbIndexPinch < 0.22 && middleExtended && ringExtended && pinkyExtended) {
    return "letterF";
  }

  // ASL/LGP "D": index up, thumb tip pressed against the middle
  // fingertip. A plain pointing hand rests the thumb on the folded middle
  // finger too (0.20-0.35 on MediaPipe's pointing photos), so only actual
  // tip contact counts.
  if (thumbMiddlePinch < 0.15 && indexExtended && othersCurled) {
    return "letterD";
  }

  // ASL/LGP "L": thumb clearly straight and index up, others folded.
  if (thumbAngle > THUMB_STRAIGHT_ANGLE && indexExtended && othersCurled) {
    return "letterL";
  }

  // ASL/LGP "I": only the pinky up, everything else (thumb too) folded.
  if (pinkyExtended && !thumbExtended && indexCurled && middleCurled && ringCurled) {
    return "letterI";
  }

  if (thumbExtended && nonThumbCurledCount === 4) {
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    if (thumbTip.y < thumbMcp.y - 0.02) return "thumbsUp";
    if (thumbTip.y > thumbMcp.y + 0.02) return "thumbsDown";
    // ASL/LGP "A": the same fist-with-thumb-out shape held sideways.
    return "letterA";
  }

  // Shaka / ASL-LGP "Y": thumb and pinky out, the middle three folded.
  if (thumbExtended && pinkyExtended && indexCurled && middleCurled && ringCurled) {
    return "shaka";
  }

  // ASL "I love you": thumb, index and pinky out, middle and ring folded.
  if (thumbExtended && indexExtended && pinkyExtended && middleCurled && ringCurled) {
    return "iLoveYou";
  }

  // "Rock on" / horns: index and pinky out with the thumb tucked (unlike
  // shaka and "I love you" above, which need the thumb out).
  if (!thumbExtended && indexExtended && pinkyExtended && middleCurled && ringCurled) {
    return "rockOn";
  }

  // Index and middle only: crossed (🤞, ASL "R"), held together (ASL "U")
  // or spread (peace sign / V / number 2). Compared along the knuckle line
  // so it works whichever way the hand is turned.
  if (indexExtended && middleExtended && ringCurled && pinkyCurled) {
    const indexTip = acrossPalm(landmarks, landmarks[8]);
    const middleTip = acrossPalm(landmarks, landmarks[12]);
    const middleKnuckle = acrossPalm(landmarks, landmarks[9]);
    // At the knuckles the middle finger sits on the pinky side of the
    // index; when the tips swap sides, the fingers are crossed.
    if (Math.sign(middleTip - indexTip) !== Math.sign(middleKnuckle) && Math.abs(middleTip - indexTip) / handScale > 0.05) {
      return "fingersCrossed";
    }
    if (Math.abs(middleTip - indexTip) / handScale < FINGERS_TOGETHER_GAP) return "letterU";
    return "peaceSign";
  }

  // W / number 3: index, middle and ring, pinky folded.
  if (indexExtended && middleExtended && ringExtended && pinkyCurled) {
    return "threeFingers";
  }

  if (indexExtended && othersCurled) {
    return "pointing";
  }

  // ASL "B" / number 4: all four fingers up, thumb folded across the palm.
  if (nonThumbExtendedCount === 4 && !thumbExtended) {
    return "letterB";
  }

  // Tolerate one misdetected finger (commonly the pinky, which is easiest
  // to lose track of at an angle) instead of requiring a perfect 4-of-4
  // match.
  if (nonThumbExtendedCount >= 3) {
    return "openPalm";
  }

  // A fist: at least three fingers clearly folded and the thumb in.
  if (nonThumbCurledCount >= 3 && nonThumbExtendedCount === 0 && !thumbExtended) {
    return "closedFist";
  }

  return "none";
}

/** Classes of MediaPipe's trained GestureRecognizer model. */
export type ModelGestureName =
  | "None"
  | "Closed_Fist"
  | "Open_Palm"
  | "Pointing_Up"
  | "Thumb_Down"
  | "Thumb_Up"
  | "Victory"
  | "ILoveYou";

const MODEL_GESTURE: Record<Exclude<ModelGestureName, "None">, HandGesture> = {
  Closed_Fist: "closedFist",
  Open_Palm: "openPalm",
  Pointing_Up: "pointing",
  Thumb_Down: "thumbsDown",
  Thumb_Up: "thumbsUp",
  Victory: "peaceSign",
  ILoveYou: "iLoveYou",
};

/** Hand-coded shapes that are a finer reading of a model class (the model
 *  was never trained on them, so it reports the broader class instead). */
const REFINEMENTS: Partial<Record<HandGesture, HandGesture[]>> = {
  peaceSign: ["letterU", "fingersCrossed"],
  openPalm: ["letterB"],
  closedFist: ["letterA"],
  thumbsUp: ["letterA"],
  pointing: ["letterL"],
};

export const MODEL_MIN_SCORE = 0.55;

/**
 * Combines the trained model's answer with the hand-coded classifier.
 *
 * Measured on MediaPipe's own test photos, the hand-coded rules alone
 * misread a fist as "O" and a pointing finger as "D"/"L" (the letter checks
 * run first and claim those shapes), while the model got all three right
 * with 0.72-0.90 confidence. So a confident model answer wins, unless the
 * hand-coded result is a finer version of the same shape (V → U, fist → A).
 * The model only knows 7 gestures and often says "None" even for a clear
 * open palm, so anything else falls back to the hand-coded result.
 */
export function fuseWithModel(
  heuristic: HandGesture,
  model?: { categoryName: string; score: number },
): HandGesture {
  if (!model || model.score < MODEL_MIN_SCORE || model.categoryName === "None") return heuristic;
  const fromModel = MODEL_GESTURE[model.categoryName as Exclude<ModelGestureName, "None">];
  if (!fromModel) return heuristic;
  if (heuristic === fromModel || REFINEMENTS[fromModel]?.includes(heuristic)) return heuristic;
  return fromModel;
}

/**
 * Smooths the classified gesture over the last few frames via a majority
 * vote, the same fix applied to `ExpressionBaselineTracker` this session:
 * showing the raw per-frame classification directly meant a single frame
 * where the hand's angle relative to the camera briefly pushed one finger
 * across a threshold (very possible even while holding a shape steady)
 * flashed the wrong gesture, or "none", before correcting itself a frame
 * later. One instance of this per tracked hand (by array position, since
 * MediaPipe doesn't give hands a stable identity across frames).
 */
export class HandGestureStabilizer {
  private recentWindow: HandGesture[] = [];
  private readonly windowSize = 5;
  private readonly requiredVotes = 3;

  push(gesture: HandGesture): HandGesture {
    this.recentWindow.push(gesture);
    if (this.recentWindow.length > this.windowSize) {
      this.recentWindow.splice(0, this.recentWindow.length - this.windowSize);
    }

    const voteCounts = new Map<HandGesture, number>();
    for (const vote of this.recentWindow) {
      voteCounts.set(vote, (voteCounts.get(vote) ?? 0) + 1);
    }
    let winner: HandGesture | null = null;
    let winnerVotes = 0;
    for (const [candidate, votes] of voteCounts) {
      if (candidate === "none" || votes < this.requiredVotes) continue;
      if (votes > winnerVotes) {
        winner = candidate;
        winnerVotes = votes;
      }
    }
    return winner ?? "none";
  }
}
