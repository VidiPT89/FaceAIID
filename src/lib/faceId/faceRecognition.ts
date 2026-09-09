"use client";

const STORAGE_KEY = "faceaiid-known-faces";
const MATCH_THRESHOLD = 0.5; // lower = stricter; face-api's own default is 0.6

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

export function getKnownFaces(): KnownFace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KnownFace[]) : [];
  } catch {
    return [];
  }
}

export function saveKnownFace(name: string, descriptor: Float32Array) {
  const faces = getKnownFaces();
  faces.push({ name, descriptor: Array.from(descriptor) });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(faces));
}

export function deleteKnownFace(name: string) {
  const faces = getKnownFaces().filter((f) => f.name !== name);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(faces));
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
  const known = getKnownFaces();
  if (known.length === 0) return null;

  let best: { name: string; distance: number } | null = null;
  for (const face of known) {
    const distance = euclideanDistance(descriptor, face.descriptor);
    if (!best || distance < best.distance) {
      best = { name: face.name, distance };
    }
  }

  if (best && best.distance <= MATCH_THRESHOLD) return best;
  return null;
}
