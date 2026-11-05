export type HeadMovement =
  | "nodYes"
  | "shakeNo"
  | "tilt"
  | "turnLeft"
  | "turnRight"
  | "lookUp"
  | "lookDown"
  | "none";

export interface Euler {
  /** Turning the head sideways; positive = toward the person's own left. */
  yaw: number;
  /** Nodding; positive = looking down. */
  pitch: number;
  /** Leaning the head toward a shoulder (in-plane rotation). */
  roll: number;
}

/**
 * Reads yaw/pitch/roll (radians) from MediaPipe's 4x4 facial transformation
 * matrix, which is stored **column-major** (the translation sits in
 * elements 12-14), in a camera space with x right, y up and z toward the
 * camera.
 *
 * An earlier version read it as row-major, which silently swapped the axes:
 * shaking the head "no" registered as nodding "yes", tilting registered as
 * shaking, and looking up/down as a tilt. Checked against MediaPipe's own
 * test photos: the 90° in-plane-rotated portrait now reads as roll ≈ -87°,
 * and mirroring a portrait flips the sign of yaw only.
 */
export function matrixToEuler(m: ArrayLike<number>): Euler {
  // Where the face's forward axis (column 2) points: sideways → yaw,
  // up/down → pitch. The nose moves to +x when turning to the person's
  // left (the camera faces them), and to -y when looking down.
  const fx = m[8];
  const fy = m[9];
  const fz = m[10];
  const yaw = Math.atan2(fx, fz);
  const pitch = Math.atan2(-fy, Math.hypot(fx, fz));
  // How far the face's right axis (column 0) has rotated toward +y.
  const roll = Math.atan2(m[1], m[0]);
  return { yaw, pitch, roll };
}

const HISTORY_SIZE = 20;
const OSCILLATION_THRESHOLD = 0.09; // radians, ~5°
/** A slight lean is normal posture; ~15° is a deliberate tilt. */
const TILT_THRESHOLD = 0.26;
/** ~20°: well past where people hold their head while reading a screen. */
const TURN_THRESHOLD = 0.35;
/** Webcams sit above the screen, so a resting head already reads a little
 *  "down"; the down bar is set further out than the up one. */
const LOOK_DOWN_THRESHOLD = 0.4;
const LOOK_UP_THRESHOLD = 0.3;

/**
 * Nod and shake are back-and-forth movements over the last ~0.7 s; tilt,
 * turn and look are held poses. Movements win over poses, so a nod isn't
 * reported as "looking down" halfway through.
 */
export class HeadMovementTracker {
  private pitchHistory: number[] = [];
  private yawHistory: number[] = [];

  push(euler: Euler): HeadMovement {
    this.pitchHistory.push(euler.pitch);
    this.yawHistory.push(euler.yaw);
    if (this.pitchHistory.length > HISTORY_SIZE) this.pitchHistory.shift();
    if (this.yawHistory.length > HISTORY_SIZE) this.yawHistory.shift();

    if (this.pitchHistory.length === HISTORY_SIZE) {
      const pitchOscillations = countSignChanges(this.pitchHistory, OSCILLATION_THRESHOLD);
      const yawOscillations = countSignChanges(this.yawHistory, OSCILLATION_THRESHOLD);
      if (pitchOscillations >= 2 && pitchOscillations >= yawOscillations) return "nodYes";
      if (yawOscillations >= 2) return "shakeNo";
    }

    if (Math.abs(euler.roll) > TILT_THRESHOLD) return "tilt";
    if (euler.yaw > TURN_THRESHOLD) return "turnLeft";
    if (euler.yaw < -TURN_THRESHOLD) return "turnRight";
    if (euler.pitch > LOOK_DOWN_THRESHOLD) return "lookDown";
    if (euler.pitch < -LOOK_UP_THRESHOLD) return "lookUp";
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
    if (Math.sign(deviations[i]) !== Math.sign(deviations[i - 1])) changes++;
  }
  return changes;
}
