"use client";

import { readStorage, writeStorage } from "@/lib/storage";

const STORAGE_KEY = "faceaiid-known-faces";
const MATCH_THRESHOLD = 0.5; // lower = stricter; face-api's own default is 0.6
/** Capped so repeatedly re-registering the same person doesn't grow
 *  localStorage unboundedly; the oldest sample is dropped once hit. */
export const MAX_SAMPLES_PER_PERSON = 5;

/** One stored sample. A person accumulates several of these across repeated
 *  "Register face" presses (different angle/lighting each time) instead of
 *  one registration overwriting the rest — matching against the best of
 *  several samples per person is meaningfully more robust than a single
 *  snapshot, given how sensitive a single face descriptor is to pose and
 *  lighting. */
export interface KnownFace {
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
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  ]);
  modelsLoaded = true;
}

export async function describeFace(input: HTMLVideoElement) {
  const faceapi = await loadFaceApi();
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
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
  let best: { name: string; distance: number } | null = null;
  for (const face of getKnownFaces()) {
    const distance = euclideanDistance(descriptor, face.descriptor);
    if (!best || distance < best.distance) {
      best = { name: face.name, distance };
    }
  }

  return best && best.distance <= MATCH_THRESHOLD ? best : null;
}
