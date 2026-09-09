import { getVisionFileset } from "./vision";

let landmarkerPromise: Promise<import("@mediapipe/tasks-vision").HandLandmarker> | null = null;

export async function getHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { HandLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await getVisionFileset();
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });
    })();
  }
  return landmarkerPromise;
}
