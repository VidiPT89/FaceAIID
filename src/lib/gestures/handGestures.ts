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
  | "letterL"
  | "letterO"
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
 * A finger is "extended" when its middle joint (PIP) is roughly straight —
 * the angle between (MCP→PIP) and (PIP→TIP) is close to 180°. This is
 * robust to the hand being rotated or tilted toward the camera, unlike a
 * pure tip-distance-from-wrist check, which only works when the hand is
 * held roughly upright and flat to the camera.
 *
 * The thumb gets a looser threshold than the other four fingers: its own
 * joint (the IP joint, between the MCP and TIP landmarks used here) doesn't
 * straighten out as close to 180° as the other fingers' PIP joints do even
 * when the thumb is genuinely held straight out to the side (thumbs up, an
 * "L" shape, shaka) — a real hand's thumb has less range of motion at that
 * joint. Using the same 140° bar as the other fingers under-detects a
 * clearly-extended thumb.
 */
function isFingerExtended(landmarks: Point[], tip: number, pip: number, mcp: number, threshold = 140): boolean {
  const angle = angleAtVertex(landmarks[mcp], landmarks[pip], landmarks[tip]);
  return angle > threshold;
}

const THUMB_EXTEND_ANGLE = 120;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
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

  const extended = FINGER_TIPS.map((tip, i) =>
    isFingerExtended(landmarks, tip, FINGER_PIPS[i], FINGER_MCPS[i], i === 0 ? THUMB_EXTEND_ANGLE : 140),
  );
  const [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended] = extended;
  const nonThumbExtendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

  // Hand scale (wrist to middle-finger MCP) so absolute-distance thresholds
  // below (thumb/index pinch for "O") stay correct regardless of how close
  // the hand is to the camera.
  const handScale = distance(landmarks[0], landmarks[9]) || 1;
  const thumbIndexPinch = distance(landmarks[4], landmarks[8]) / handScale;

  // ASL/LGP fingerspelling letter "O": thumb and index tips pinched together
  // into a circle, the other three fingers curled alongside (not fully
  // extended, not fully closed like a fist). Checked before closedFist,
  // which would otherwise claim this shape.
  if (thumbIndexPinch < 0.22 && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return "letterO";
  }

  // ASL/LGP fingerspelling letter "L": thumb and index extended at a right
  // angle, other three fingers closed.
  if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return "letterL";
  }

  if (thumbExtended && nonThumbExtendedCount === 0) {
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    if (thumbTip.y < thumbMcp.y - 0.02) return "thumbsUp";
    if (thumbTip.y > thumbMcp.y + 0.02) return "thumbsDown";
  }

  // Shaka / ASL-LGP "Y": thumb and pinky extended, the three middle fingers
  // closed.
  if (thumbExtended && pinkyExtended && !indexExtended && !middleExtended && !ringExtended) {
    return "shaka";
  }

  // ASL "I love you": thumb, index and pinky extended, middle and ring closed.
  if (thumbExtended && indexExtended && pinkyExtended && !middleExtended && !ringExtended) {
    return "iLoveYou";
  }

  // Peace sign / V / number 2: index and middle only.
  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return "peaceSign";
  }

  // W / number 3: index, middle and ring, no pinky. Checked before the
  // tolerant "openPalm" fallback below, which would otherwise swallow it
  // (3 non-thumb fingers extended).
  if (indexExtended && middleExtended && ringExtended && !pinkyExtended) {
    return "threeFingers";
  }

  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return "pointing";
  }

  // Tolerate one misdetected finger (commonly the pinky, which is easiest
  // to lose track of at an angle) instead of requiring a perfect 4-of-4
  // match.
  if (nonThumbExtendedCount >= 3) {
    return "openPalm";
  }

  if (nonThumbExtendedCount <= 1 && !thumbExtended) {
    return "closedFist";
  }

  return "none";
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
