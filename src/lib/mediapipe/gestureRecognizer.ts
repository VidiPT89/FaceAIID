import { getVisionFileset } from "./vision";

let recognizerPromise: Promise<import("@mediapipe/tasks-vision").GestureRecognizer> | null = null;

/**
 * MediaPipe's GestureRecognizer: the same hand landmark model as
 * HandLandmarker, plus a classifier trained on 7 common gestures. Its
 * answer is combined with the hand-coded shapes in `fuseWithModel`.
 */
export async function getGestureRecognizer() {
  if (!recognizerPromise) {
    recognizerPromise = (async () => {
      const { GestureRecognizer } = await import("@mediapipe/tasks-vision");
      const vision = await getVisionFileset();
      return GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        // Defaults (0.5) are conservative and miss hands that are at an
        // angle, partly out of frame or a bit far from the camera.
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    })().catch((err) => {
      recognizerPromise = null;
      throw err;
    });
  }
  return recognizerPromise;
}
