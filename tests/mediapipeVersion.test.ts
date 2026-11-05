import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEDIAPIPE_WASM_VERSION } from "@/lib/mediapipe/vision";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

describe("MediaPipe WASM version", () => {
  // The WASM runtime is loaded from a CDN by version while the JS bundle
  // comes from node_modules; a mismatch between the two once went unnoticed
  // (0.10.14 WASM with the 1.0.1 package).
  it("matches the installed @mediapipe/tasks-vision package", () => {
    expect(readJson("../node_modules/@mediapipe/tasks-vision/package.json").version).toBe(MEDIAPIPE_WASM_VERSION);
  });

  it("is pinned exactly in package.json, so an install can't drift from it", () => {
    expect(readJson("../package.json").dependencies["@mediapipe/tasks-vision"]).toBe(MEDIAPIPE_WASM_VERSION);
  });
});
