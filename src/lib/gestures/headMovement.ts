export type HeadMovement = "nodYes" | "shakeNo" | "tilt" | "none";

interface Euler {
  yaw: number;
  pitch: number;
  roll: number;
}

/**
 * Decomposes a 4x4 row-major facial transformation matrix (as produced by
 * MediaPipe's FaceLandmarker) into approximate yaw/pitch/roll. The exact
 * physical accuracy doesn't matter here — only that the sign and relative
 * magnitude stay consistent frame to frame, since classification below only
 * thresholds and looks at oscillation, not absolute angle.
 */
export function matrixToEuler(matrix: number[]): Euler {
  const r00 = matrix[0];
  const r10 = matrix[4];
  const r20 = matrix[8];
  const r21 = matrix[9];
  const r22 = matrix[10];

  const pitch = Math.atan2(-r20, Math.sqrt(r00 * r00 + r10 * r10));
  const yaw = Math.atan2(r10, r00);
  const roll = Math.atan2(r21, r22);

  return { yaw, pitch, roll };
}

const HISTORY_SIZE = 20;
const OSCILLATION_THRESHOLD = 0.09; // radians, ~5 degrees
const TILT_THRESHOLD = 0.2; // radians, ~11 degrees

export class HeadMovementTracker {
  private pitchHistory: number[] = [];
  private yawHistory: number[] = [];

  push(euler: Euler): HeadMovement {
    this.pitchHistory.push(euler.pitch);
    this.yawHistory.push(euler.yaw);
    if (this.pitchHistory.length > HISTORY_SIZE) this.pitchHistory.shift();
    if (this.yawHistory.length > HISTORY_SIZE) this.yawHistory.shift();

    if (this.pitchHistory.length < HISTORY_SIZE) return "none";

    const pitchOscillations = countSignChanges(this.pitchHistory, OSCILLATION_THRESHOLD);
    const yawOscillations = countSignChanges(this.yawHistory, OSCILLATION_THRESHOLD);

    if (pitchOscillations >= 2 && pitchOscillations >= yawOscillations) return "nodYes";
    if (yawOscillations >= 2) return "shakeNo";
    if (Math.abs(euler.roll) > TILT_THRESHOLD) return "tilt";
    return "none";
  }

  reset() {
    this.pitchHistory = [];
    this.yawHistory = [];
  }
}

function countSignChanges(values: number[], threshold: number): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const deviations = values.map((v) => v - mean).filter((d) => Math.abs(d) > threshold);
  let changes = 0;
  for (let i = 1; i < deviations.length; i++) {
    if (Math.sign(deviations[i]) !== Math.sign(deviations[i - 1]) && Math.sign(deviations[i]) !== 0) {
      changes++;
    }
  }
  return changes;
}
