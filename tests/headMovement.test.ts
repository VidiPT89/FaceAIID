import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HeadMovementTracker, matrixToEuler, type Euler } from "@/lib/gestures/headMovement";

const DEG = Math.PI / 180;

/** Column-major 4x4 rotation, as MediaPipe stores it. */
function columnMajor(r: number[][]): number[] {
  const out = new Array(16).fill(0);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) out[col * 4 + row] = r[row][col];
  out[15] = 1;
  return out;
}
const aboutY = (a: number) => columnMajor([[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]]);
const aboutX = (a: number) => columnMajor([[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]]);
const aboutZ = (a: number) => columnMajor([[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]]);

const faces: { image: string; matrix: number[] }[] = JSON.parse(
  readFileSync(new URL("./fixtures/mediapipe-real.json", import.meta.url), "utf8"),
).faces;
const face = (image: string) => matrixToEuler(faces.find((f) => f.image === image)!.matrix);

describe("matrixToEuler", () => {
  it("maps each single-axis rotation to its own angle only", () => {
    const turn = matrixToEuler(aboutY(30 * DEG));
    expect(turn.yaw).toBeCloseTo(30 * DEG);
    expect(turn.pitch).toBeCloseTo(0);
    expect(turn.roll).toBeCloseTo(0);

    // Rotating about x by +a moves the nose down: looking down.
    const nod = matrixToEuler(aboutX(25 * DEG));
    expect(nod.pitch).toBeCloseTo(25 * DEG);
    expect(nod.yaw).toBeCloseTo(0);

    const lean = matrixToEuler(aboutZ(20 * DEG));
    expect(lean.roll).toBeCloseTo(20 * DEG);
    expect(lean.yaw).toBeCloseTo(0);
    expect(lean.pitch).toBeCloseTo(0);
  });

  it("reads a real portrait rotated 90° in-plane as roll, not yaw or pitch", () => {
    const rotated = face("portrait_rotated.jpg");
    expect(rotated.roll).toBeLessThan(-80 * DEG);
    expect(Math.abs(rotated.yaw)).toBeLessThan(15 * DEG);
    expect(Math.abs(rotated.pitch)).toBeLessThan(15 * DEG);
  });

  it("flips only yaw (and roll) when a real portrait is mirrored", () => {
    const original = face("portrait.jpg");
    const mirrored = face("portrait_mirror.jpg");
    expect(Math.sign(original.yaw)).toBe(-Math.sign(mirrored.yaw));
    expect(Math.sign(original.pitch)).toBe(Math.sign(mirrored.pitch));
  });
});

describe("HeadMovementTracker", () => {
  const hold = (pose: Partial<Euler>, frames = 1) => {
    const tracker = new HeadMovementTracker();
    let result = tracker.push({ yaw: 0, pitch: 0, roll: 0, ...pose });
    for (let i = 1; i < frames; i++) result = tracker.push({ yaw: 0, pitch: 0, roll: 0, ...pose });
    return result;
  };

  it("reports held poses", () => {
    expect(hold({})).toBe("none");
    expect(hold({ yaw: 30 * DEG })).toBe("turnLeft");
    expect(hold({ yaw: -30 * DEG })).toBe("turnRight");
    expect(hold({ pitch: 30 * DEG })).toBe("lookDown");
    expect(hold({ pitch: -25 * DEG })).toBe("lookUp");
    expect(hold({ roll: 20 * DEG })).toBe("tilt");
  });

  it("ignores the slight downward angle of a head reading a screen below the camera", () => {
    expect(hold({ pitch: 12 * DEG }, 25)).toBe("none");
  });

  const oscillate = (axis: "yaw" | "pitch") => {
    const tracker = new HeadMovementTracker();
    let result = tracker.push({ yaw: 0, pitch: 0, roll: 0 });
    for (let i = 0; i < 24; i++) {
      const swing = (i % 6 < 3 ? 1 : -1) * 12 * DEG;
      result = tracker.push({ yaw: 0, pitch: 0, roll: 0, [axis]: swing });
    }
    return result;
  };

  it("detects nodding from pitch and shaking from yaw", () => {
    expect(oscillate("pitch")).toBe("nodYes");
    expect(oscillate("yaw")).toBe("shakeNo");
  });
});
