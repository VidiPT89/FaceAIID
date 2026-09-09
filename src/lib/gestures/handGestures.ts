export type HandGesture = "thumbsUp" | "openPalm" | "closedFist" | "peaceSign" | "pointing" | "none";

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
 */
function isFingerExtended(landmarks: Point[], tip: number, pip: number, mcp: number): boolean {
  const angle = angleAtVertex(landmarks[mcp], landmarks[pip], landmarks[tip]);
  return angle > 140;
}

export function classifyHandGesture(landmarks: Point[]): HandGesture {
  if (!landmarks || landmarks.length < 21) return "none";

  const extended = FINGER_TIPS.map((tip, i) => isFingerExtended(landmarks, tip, FINGER_PIPS[i], FINGER_MCPS[i]));
  const [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended] = extended;
  const nonThumbExtended = [indexExtended, middleExtended, ringExtended, pinkyExtended];
  const nonThumbExtendedCount = nonThumbExtended.filter(Boolean).length;

  if (thumbExtended && nonThumbExtendedCount === 0) {
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    if (thumbTip.y < thumbMcp.y - 0.02) {
      return "thumbsUp";
    }
  }

  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return "peaceSign";
  }

  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return "pointing";
  }

  // Tolerate one misdetected finger (commonly the pinky, which is easiest
  // to lose track of at an angle) instead of requiring a perfect 4-of-4 or
  // 0-of-4 match.
  if (nonThumbExtendedCount >= 3) {
    return "openPalm";
  }

  if (nonThumbExtendedCount <= 1 && !thumbExtended) {
    return "closedFist";
  }

  return "none";
}
