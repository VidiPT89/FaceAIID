import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "faceaiid-known-faces";

function stubStorage(initial: Record<string, string> = {}, { failWrites = false } = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWrites) throw new Error("QuotaExceededError");
        data.set(key, value);
      },
    },
  });
  return data;
}

// The module caches what it read from storage, so each test gets a fresh copy.
const load = () => import("@/lib/faceId/faceRecognition");
const descriptor = (value: number) => new Float32Array(128).fill(value);

describe("face recognition storage", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("keeps only the newest samples per person", async () => {
    stubStorage();
    const faces = await load();
    for (let i = 0; i < faces.MAX_SAMPLES_PER_PERSON + 2; i++) faces.saveKnownFace("Ana", descriptor(i));
    expect(faces.sampleCountFor("Ana")).toBe(faces.MAX_SAMPLES_PER_PERSON);
    expect(faces.getKnownFaces()[0].descriptor[0]).toBe(2);
  });

  it("matches the closest registered person within the threshold", async () => {
    stubStorage();
    const faces = await load();
    faces.saveKnownFace("Ana", descriptor(0));
    faces.saveKnownFace("Rui", descriptor(0.2));
    expect(faces.matchFace(descriptor(0.01))?.name).toBe("Ana");
    expect(faces.matchFace(descriptor(0.5))).toBeNull();
  });

  it("ignores corrupted stored data instead of throwing", async () => {
    stubStorage({ [STORAGE_KEY]: '[{"name":"Ana"},"junk",{"name":"Rui","descriptor":[0]}]' });
    const faces = await load();
    expect(faces.getKnownFaceNames()).toEqual(["Rui"]);
  });

  it("reports a failed save and keeps the previous state", async () => {
    stubStorage({}, { failWrites: true });
    const faces = await load();
    expect(faces.saveKnownFace("Ana", descriptor(0))).toBe(false);
    expect(faces.getKnownFaceNames()).toEqual([]);
  });

  it("removes every sample of a deleted person", async () => {
    const data = stubStorage();
    const faces = await load();
    faces.saveKnownFace("Ana", descriptor(0));
    faces.saveKnownFace("Ana", descriptor(0.1));
    faces.deleteKnownFace("Ana");
    expect(faces.getKnownFaceNames()).toEqual([]);
    expect(data.get(STORAGE_KEY)).toBe("[]");
  });
});
