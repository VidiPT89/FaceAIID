import type { FilesetResolver as FilesetResolverType } from "@mediapipe/tasks-vision";

let filesetPromise: Promise<Awaited<ReturnType<typeof FilesetResolverType.forVisionTasks>>> | null = null;

export async function getVisionFileset() {
  if (!filesetPromise) {
    filesetPromise = (async () => {
      const { FilesetResolver } = await import("@mediapipe/tasks-vision");
      return FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );
    })();
  }
  return filesetPromise;
}
