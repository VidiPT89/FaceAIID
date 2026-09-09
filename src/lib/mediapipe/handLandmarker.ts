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
        // Defaults (0.5) are conservative and can miss hands that are at an
        // angle, partly out of frame, or a bit far from the camera. Lower
        // thresholds trade a little precision for noticeably more reliable
        // detection in typical webcam conditions.
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    })();
  }
  return landmarkerPromise;
}
