"use client";

import { readStorage, writeStorage } from "@/lib/storage";

const STORAGE_KEY = "faceaiid-known-faces";
/** Lower = stricter; face-api's own default is 0.6. Measured on MediaPipe's
 *  public portraits: the same person scored 0.14-0.24, different people
 *  0.86-0.89 — 0.5 leaves a wide margin on both sides. */
const MATCH_THRESHOLD = 0.5;
/** A name is only given when the next-closest *other* person is at least
 *  this much further away, so two similar registered faces don't flip-flop. */
const MIN_MARGIN_TO_NEXT_PERSON = 0.08;
/** Below this detection confidence the face is too turned or blurred for a
 *  trustworthy descriptor (a 90°-rotated portrait detected at 0.71 scored
 *  0.81 against the same person), so no identity decision is made. */
export const MIN_DETECTION_SCORE = 0.8;
/** Registration needs a clearer view than recognition: a sharp, frontal,
 *  reasonably close face gives every later comparison a good reference. */
export const MIN_REGISTRATION_SCORE = 0.9;
/** Fraction of the frame width. A ~15 cm face fills 13-18% of a typical
 *  ~70° webcam frame at 60-80 cm, so 10% allows up to about a metre away. */
export const MIN_REGISTRATION_FACE_WIDTH = 0.1;
/** Capped so repeatedly re-registering the same person doesn't grow
 *  localStorage unboundedly; the oldest sample is dropped once hit. */
export const MAX_SAMPLES_PER_PERSON = 5;

/** One stored sample. A person accumulates several of these across repeated
 *  "Register face" presses (different angle/lighting each time) instead of
 *  one registration overwriting the rest — matching against the best of
 *  several samples per person is meaningfully more robust than a single
 *  snapshot, given how sensitive a single face descriptor is to pose and
 *  lighting. */
interface KnownFace {
  name: string;
  descriptor: number[];
}

let modelsLoaded = false;

// face-api.js touches browser-only APIs (TextEncoder, canvas, WebGL) at
// import time, which breaks Next.js's server-side prerender pass. Loading it
// dynamically, only when actually invoked client-side, avoids that entirely.
async function loadFaceApi() {
  return import("@vladmandic/face-api");
}

export async function loadFaceModels() {
  if (modelsLoaded) return;
  const faceapi = await loadFaceApi();
  await Promise.all([
    // SSD MobileNet rather than the tiny detector: on MediaPipe's test
    // portraits it found every face (tiny missed the rotated one) at 0.99+
    // confidence instead of 0.93-0.96, and a better-placed face box gives a
    // better-aligned descriptor.
    faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  ]);
  modelsLoaded = true;
}

export async function describeFace(input: HTMLVideoElement) {
  const faceapi = await loadFaceApi();
  const result = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result ?? null;
}

/** In-memory copy of what's in localStorage. Matching runs on every
 *  recognized frame; re-reading and re-parsing the stored JSON each time was
 *  pure overhead, since only this module ever writes it. */
let cache: KnownFace[] | null = null;

function isKnownFace(value: unknown): value is KnownFace {
  const face = value as KnownFace;
  return typeof face?.name === "string" && Array.isArray(face.descriptor);
}

export function getKnownFaces(): KnownFace[] {
  if (typeof window === "undefined") return [];
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(readStorage(STORAGE_KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed.filter(isKnownFace) : [];
  } catch {
    cache = [];
  }
  return cache;
}

/** Returns false when the browser refused to persist the change. */
function persist(faces: KnownFace[]): boolean {
  if (!writeStorage(STORAGE_KEY, JSON.stringify(faces))) return false;
  cache = faces;
  return true;
}

export function saveKnownFace(name: string, descriptor: Float32Array): boolean {
  const all = getKnownFaces();
  const samplesForName = all.filter((f) => f.name === name);
  samplesForName.push({ name, descriptor: Array.from(descriptor) });
  if (samplesForName.length > MAX_SAMPLES_PER_PERSON) {
    samplesForName.splice(0, samplesForName.length - MAX_SAMPLES_PER_PERSON);
  }
  const others = all.filter((f) => f.name !== name);
  return persist([...others, ...samplesForName]);
}

export function sampleCountFor(name: string): number {
  return getKnownFaces().filter((f) => f.name === name).length;
}

/** One row per distinct registered person, for UI lists — collapses the
 *  (possibly several) samples behind each name into one entry. */
export function getKnownFaceNames(): string[] {
  return [...new Set(getKnownFaces().map((face) => face.name))];
}

export function deleteKnownFace(name: string) {
  persist(getKnownFaces().filter((f) => f.name !== name));
}

function euclideanDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function matchFace(descriptor: Float32Array): { name: string; distance: number } | null {
  // Closest sample per person, then compare the two closest people.
  const closest = new Map<string, number>();
  for (const face of getKnownFaces()) {
    const distance = euclideanDistance(descriptor, face.descriptor);
    if (distance < (closest.get(face.name) ?? Infinity)) closest.set(face.name, distance);
  }
  const [best, runnerUp] = [...closest].sort((a, b) => a[1] - b[1]);
  if (!best || best[1] > MATCH_THRESHOLD) return null;
  if (runnerUp && runnerUp[1] - best[1] < MIN_MARGIN_TO_NEXT_PERSON) return null;
  return { name: best[0], distance: best[1] };
}

/**
 * Shows a name only once it wins most of the last few decisions, so one
 * off frame (motion blur, a hand passing in front) doesn't flash "not
 * recognized" or, worse, someone else's name.
 */
export class IdentityStabilizer {
  private recent: (string | null)[] = [];
  private readonly windowSize = 5;
  private readonly requiredVotes = 3;
  private shown: string | null = null;

  push(name: string | null): string | null {
    this.recent.push(name);
    if (this.recent.length > this.windowSize) this.recent.shift();
    const votes = new Map<string | null, number>();
    for (const vote of this.recent) votes.set(vote, (votes.get(vote) ?? 0) + 1);
    for (const [candidate, count] of votes) {
      if (count >= this.requiredVotes) this.shown = candidate;
    }
    return this.shown;
  }

  reset() {
    this.recent = [];
    this.shown = null;
  }
}
