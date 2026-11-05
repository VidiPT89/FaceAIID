import type { FilesetResolver as FilesetResolverType } from "@mediapipe/tasks-vision";

/**
 * Must match the installed `@mediapipe/tasks-vision` exactly (pinned in
 * package.json): the JS bundle and the WASM runtime are released together
 * and aren't guaranteed compatible across versions. This was 0.10.14 while
 * the package was 1.0.1. `tests/mediapipeVersion.test.ts` keeps them in sync.
 */
export const MEDIAPIPE_WASM_VERSION = "1.0.1";

let filesetPromise: Promise<Awaited<ReturnType<typeof FilesetResolverType.forVisionTasks>>> | null = null;

export async function getVisionFileset() {
  if (!filesetPromise) {
    filesetPromise = (async () => {
      const { FilesetResolver } = await import("@mediapipe/tasks-vision");
      return FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_WASM_VERSION}/wasm`,
      );
    })().catch((err) => {
      // Don't cache a failure (e.g. offline for a moment): the next press
      // of "Start camera" should retry instead of failing forever.
      filesetPromise = null;
      throw err;
    });
  }
  return filesetPromise;
}
