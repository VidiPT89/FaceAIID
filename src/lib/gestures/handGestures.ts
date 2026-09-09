export type HandGesture = "thumbsUp" | "openPalm" | "closedFist" | "none";

interface Point {
  x: number;
  y: number;
  z: number;
}

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 6, 10, 14, 18];
const FINGER_MCPS = [2, 5, 9, 13, 17];

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isFingerExtended(landmarks: Point[], tip: number, pip: number, mcp: number, wrist: Point) {
  return distance(landmarks[tip], wrist) > distance(landmarks[pip], wrist) &&
    distance(landmarks[pip], wrist) > distance(landmarks[mcp], wrist) * 0.9;
}

export function classifyHandGesture(landmarks: Point[]): HandGesture {
  if (!landmarks || landmarks.length < 21) return "none";

  const wrist = landmarks[0];
  const extended = FINGER_TIPS.map((tip, i) =>
    isFingerExtended(landmarks, tip, FINGER_PIPS[i], FINGER_MCPS[i], wrist),
  );
  const [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended] = extended;
  const nonThumbExtendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(
    Boolean,
  ).length;

  if (thumbExtended && nonThumbExtendedCount === 0) {
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    if (thumbTip.y < thumbMcp.y - 0.02) {
      return "thumbsUp";
    }
  }

  if (nonThumbExtendedCount === 4) {
    return "openPalm";
  }

  if (!thumbExtended && nonThumbExtendedCount === 0) {
    return "closedFist";
  }

  return "none";
}
