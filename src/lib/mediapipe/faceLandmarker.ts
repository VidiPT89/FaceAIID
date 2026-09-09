import { getVisionFileset } from "./vision";

let landmarkerPromise: Promise<import("@mediapipe/tasks-vision").FaceLandmarker> | null = null;

export async function getFaceLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await getVisionFileset();
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    })();
  }
  return landmarkerPromise;
}
