"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useDebugMode } from "@/lib/debugMode";
import { getFaceLandmarker } from "@/lib/mediapipe/faceLandmarker";
import {
  ExpressionBaselineTracker,
  computeExpressionScores,
  type ExpressionScores,
  type FacialExpression,
} from "@/lib/gestures/facialExpressions";
import { HeadMovementTracker, matrixToEuler, type Euler, type HeadMovement } from "@/lib/gestures/headMovement";
import { useCameraLoop } from "@/lib/useCameraLoop";
import { prepareMirroredFrame } from "@/lib/canvas";
import CameraStage, { Badge, BadgeRow } from "@/components/CameraStage";

type FaceLandmarker = import("@mediapipe/tasks-vision").FaceLandmarker;
type DrawingUtils = import("@mediapipe/tasks-vision").DrawingUtils;
type Connections = { start: number; end: number }[];

const expressionLabelKey: Record<Exclude<FacialExpression, "none">, string> = {
  smile: "expression.smile",
  sad: "expression.sad",
  surprised: "expression.surprised",
  angry: "expression.angry",
  blink: "expression.blink",
  laugh: "expression.laugh",
  kiss: "expression.kiss",
  cheekPuff: "expression.cheekPuff",
  mouthOpen: "expression.mouthOpen",
  browsRaised: "expression.browsRaised",
  wink: "expression.wink",
};

const headLabelKey: Record<Exclude<HeadMovement, "none">, string> = {
  nodYes: "head.nodYes",
  shakeNo: "head.shakeNo",
  tilt: "head.tilt",
  turnLeft: "head.turnLeft",
  turnRight: "head.turnRight",
  lookUp: "head.lookUp",
  lookDown: "head.lookDown",
};

interface FaceConnectionSets {
  tesselation: Connections;
  contours: Connections;
  leftIris: Connections;
  rightIris: Connections;
}

export default function FaceCameraFeed() {
  const { t } = useLanguage();
  const { debugMode } = useDebugMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const connectionsRef = useRef<FaceConnectionSets | null>(null);
  const headTrackerRef = useRef(new HeadMovementTracker());
  const expressionTrackerRef = useRef(new ExpressionBaselineTracker());
  const debugModeRef = useRef(debugMode);

  const [expression, setExpression] = useState<FacialExpression>("none");
  const [headMovement, setHeadMovement] = useState<HeadMovement>("none");
  const [faceDetected, setFaceDetected] = useState(false);
  const [scores, setScores] = useState<ExpressionScores | null>(null);
  const [pose, setPose] = useState<Euler | null>(null);

  useEffect(() => {
    debugModeRef.current = debugMode;
  }, [debugMode]);

  const prepare = useCallback(async () => {
    landmarkerRef.current = await getFaceLandmarker();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) throw new Error("canvas 2D context unavailable");
    const { DrawingUtils, FaceLandmarker } = await import("@mediapipe/tasks-vision");
    drawingUtilsRef.current = new DrawingUtils(ctx);
    connectionsRef.current = {
      tesselation: FaceLandmarker.FACE_LANDMARKS_TESSELATION,
      contours: FaceLandmarker.FACE_LANDMARKS_CONTOURS,
      leftIris: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
      rightIris: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
    };
  }, []);

  const onFrame = useCallback((video: HTMLVideoElement) => {
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const drawingUtils = drawingUtilsRef.current;
    const connections = connectionsRef.current;
    if (!canvas || !landmarker || !drawingUtils || !connections) return;

    const result = landmarker.detectForVideo(video, performance.now());
    const ctx = prepareMirroredFrame(canvas, video);
    const landmarks = result.faceLandmarks[0];
    try {
      if (landmarks) {
        // Full mesh first (faint), then the key contours bold on top, then
        // the irises — the same layering MediaPipe's own demos use.
        drawingUtils.drawConnectors(landmarks, connections.tesselation, { color: "rgba(255, 183, 3, 0.35)", lineWidth: 1 });
        drawingUtils.drawConnectors(landmarks, connections.contours, { color: "#ff7a1a", lineWidth: 2 });
        drawingUtils.drawConnectors(landmarks, connections.leftIris, { color: "#d94a1a", lineWidth: 2 });
        drawingUtils.drawConnectors(landmarks, connections.rightIris, { color: "#d94a1a", lineWidth: 2 });
      }
    } finally {
      ctx.restore();
    }
    // Primitive setters bail out when the value is unchanged, so these
    // don't re-render on frames where nothing changed.
    setFaceDetected(!!landmarks);

    const blendshapes = result.faceBlendshapes?.[0]?.categories ?? [];
    if (blendshapes.length > 0) {
      const currentScores = computeExpressionScores(blendshapes);
      setExpression(expressionTrackerRef.current.classify(currentScores));
      if (debugModeRef.current) setScores(currentScores);
    } else {
      expressionTrackerRef.current.reset();
      setExpression("none");
      setScores(null);
    }

    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    if (matrix) {
      const euler = matrixToEuler(matrix);
      setHeadMovement(headTrackerRef.current.push(euler));
      if (debugModeRef.current) setPose(euler);
    } else {
      headTrackerRef.current.reset();
      setHeadMovement("none");
    }
  }, []);

  const onStop = useCallback(() => {
    headTrackerRef.current.reset();
    expressionTrackerRef.current.reset();
    setExpression("none");
    setHeadMovement("none");
    setFaceDetected(false);
    setScores(null);
    setPose(null);
  }, []);

  const camera = useCameraLoop({ prepare, onFrame, onStop });

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <CameraStage
        camera={camera}
        idleText={t("hero.subtitleFace")}
        canvas={<canvas ref={canvasRef} className="w-full h-full object-cover" />}
        badges={
          <BadgeRow show={expression !== "none" || headMovement !== "none"} animationKey={`${expression}-${headMovement}`}>
            {expression !== "none" && <Badge>{t(expressionLabelKey[expression])}</Badge>}
            {headMovement !== "none" && <Badge>{t(headLabelKey[headMovement])}</Badge>}
          </BadgeRow>
        }
        debugLines={
          debugMode && (
            <>
              <div>face: {faceDetected ? "yes" : "no"}</div>
              {scores && (
                <div>
                  smile {scores.smile.toFixed(2)} · frown {scores.frown.toFixed(2)} · browDown {scores.browDown.toFixed(2)} ·
                  browUp {scores.browInnerUp.toFixed(2)}/{scores.browOuterUp.toFixed(2)} · jaw {scores.jawOpen.toFixed(2)}
                  <br />
                  pucker {scores.pucker.toFixed(2)} · puff {scores.cheekPuff.toFixed(2)} · eyes {scores.blink.toFixed(2)}/
                  {scores.blinkMax.toFixed(2)}
                </div>
              )}
              {pose && (
                <div>
                  yaw {((pose.yaw * 180) / Math.PI).toFixed(0)}° · pitch {((pose.pitch * 180) / Math.PI).toFixed(0)}° · roll{" "}
                  {((pose.roll * 180) / Math.PI).toFixed(0)}°
                </div>
              )}
            </>
          )
        }
      />
    </div>
  );
}
