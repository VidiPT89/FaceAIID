"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import { useDebugMode } from "@/lib/debugMode";
import { getFaceLandmarker } from "@/lib/mediapipe/faceLandmarker";
import { ExpressionBaselineTracker, computeExpressionScores, type ExpressionScores, type FacialExpression } from "@/lib/gestures/facialExpressions";
import { HeadMovementTracker, matrixToEuler, type HeadMovement } from "@/lib/gestures/headMovement";

type Status = "idle" | "loading" | "running" | "denied" | "error";

const expressionLabelKey: Record<FacialExpression, string> = {
  smile: "expression.smile",
  sad: "expression.sad",
  surprised: "expression.surprised",
  angry: "expression.angry",
  blink: "expression.blink",
  none: "expression.none",
};

const headLabelKey: Record<HeadMovement, string> = {
  nodYes: "head.nodYes",
  shakeNo: "head.shakeNo",
  tilt: "head.tilt",
  none: "head.none",
};

interface FaceConnectionSets {
  tesselation: { start: number; end: number }[];
  contours: { start: number; end: number }[];
  leftIris: { start: number; end: number }[];
  rightIris: { start: number; end: number }[];
}

export default function FaceCameraFeed() {
  const { t } = useLanguage();
  const { debugMode } = useDebugMode();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").FaceLandmarker | null>(null);
  const drawingUtilsRef = useRef<import("@mediapipe/tasks-vision").DrawingUtils | null>(null);
  const connectionsRef = useRef<FaceConnectionSets | null>(null);
  const trackerRef = useRef(new HeadMovementTracker());
  const expressionTrackerRef = useRef(new ExpressionBaselineTracker());
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<() => void>(() => {});

  const [status, setStatus] = useState<Status>("idle");
  const [expression, setExpression] = useState<FacialExpression>("none");
  const [headMovement, setHeadMovement] = useState<HeadMovement>("none");
  const [faceDetected, setFaceDetected] = useState(false);
  const [loopError, setLoopError] = useState<string | null>(null);
  const [scores, setScores] = useState<ExpressionScores | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    trackerRef.current.reset();
    expressionTrackerRef.current.reset();
    setStatus("idle");
    setExpression("none");
    setHeadMovement("none");
  }, []);

  useEffect(() => stop, [stop]);

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const drawingUtils = drawingUtilsRef.current;
    const connections = connectionsRef.current;
    if (!video || !canvas || !landmarker || !drawingUtils || !connections || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => loopRef.current());
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // See the matching comment in CameraFeed.tsx: an uncaught error here
    // would otherwise kill the detection loop for good while the camera
    // keeps looking "on".
    try {
      const result = landmarker.detectForVideo(video, performance.now());

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      // The actual camera image was never drawn here before — only the
      // mesh — so the canvas showed floating lines on an empty background
      // instead of the live picture underneath them.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const hasFace = !!(result.faceLandmarks && result.faceLandmarks.length > 0);

      if (hasFace) {
        const landmarks = result.faceLandmarks[0];
        // Full mesh first (faint), then the key contours (eyes, eyebrows,
        // lips, face oval) drawn bold on top, then the irises — the same
        // layering MediaPipe's own face mesh demos use so every tracked
        // point is visibly represented, not just a rough outline.
        drawingUtils.drawConnectors(landmarks, connections.tesselation, {
          color: "rgba(255, 183, 3, 0.35)",
          lineWidth: 1,
        });
        drawingUtils.drawConnectors(landmarks, connections.contours, {
          color: "#ff7a1a",
          lineWidth: 2,
        });
        drawingUtils.drawConnectors(landmarks, connections.leftIris, {
          color: "#d94a1a",
          lineWidth: 2,
        });
        drawingUtils.drawConnectors(landmarks, connections.rightIris, {
          color: "#d94a1a",
          lineWidth: 2,
        });
      }

      ctx.restore();
      setFaceDetected(hasFace);

      const blendshapes = result.faceBlendshapes?.[0]?.categories ?? [];
      if (blendshapes.length > 0) {
        const currentScores = computeExpressionScores(blendshapes);
        setExpression(expressionTrackerRef.current.classify(currentScores));
        setScores(currentScores);
      } else {
        expressionTrackerRef.current.reset();
        setExpression("none");
        setScores(null);
      }

      const matrix = result.facialTransformationMatrixes?.[0]?.data;
      if (matrix) {
        const euler = matrixToEuler(Array.from(matrix));
        setHeadMovement(trackerRef.current.push(euler));
      }
      setLoopError(null);
    } catch (err) {
      console.error("[FaceAIID] face detection frame failed", err);
      setLoopError(err instanceof Error ? err.message : String(err));
    }

    rafRef.current = requestAnimationFrame(() => loopRef.current());
  }, []);

  useEffect(() => {
    loopRef.current = detectLoop;
  }, [detectLoop]);

  const start = useCallback(async () => {
    setStatus("loading");
    try {
      landmarkerRef.current = await getFaceLandmarker();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      video.srcObject = stream;
      await video.play();

      const ctx = canvas.getContext("2d");
      if (ctx) {
        const { DrawingUtils, FaceLandmarker } = await import("@mediapipe/tasks-vision");
        drawingUtilsRef.current = new DrawingUtils(ctx);
        connectionsRef.current = {
          tesselation: FaceLandmarker.FACE_LANDMARKS_TESSELATION,
          contours: FaceLandmarker.FACE_LANDMARKS_CONTOURS,
          leftIris: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
          rightIris: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
        };
      }

      setStatus("running");
      rafRef.current = requestAnimationFrame(() => loopRef.current());
    } catch (err) {
      console.error(err);
      const domErr = err as DOMException;
      setStatus(domErr?.name === "NotAllowedError" ? "denied" : "error");
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden border border-border bg-surface shadow-2xl shadow-black/10">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
        <AnimatePresence>
          {status !== "running" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-muted/95 text-center px-6"
            >
              {status === "loading" && (
                <>
                  <div className="h-10 w-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                  <p className="text-foreground-muted">{t("camera.loading")}</p>
                </>
              )}
              {status === "denied" && <p className="text-accent-3">{t("camera.permission")}</p>}
              {status === "error" && <p className="text-accent-3">{t("camera.error")}</p>}
              {status === "idle" && <p className="text-foreground-muted">{t("hero.subtitleFace")}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === "running" && (expression !== "none" || headMovement !== "none") && (
            <motion.div
              key={`${expression}-${headMovement}`}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2"
            >
              {expression !== "none" && (
                <span className="gradient-brand text-black font-semibold px-4 py-2 rounded-full shadow-lg text-sm">
                  {t(expressionLabelKey[expression])}
                </span>
              )}
              {headMovement !== "none" && (
                <span className="gradient-brand text-black font-semibold px-4 py-2 rounded-full shadow-lg text-sm">
                  {t(headLabelKey[headMovement])}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {status === "running" && (loopError || debugMode) && (
          <div className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-mono text-white/90 leading-tight">
            {loopError && <div>error: {loopError}</div>}
            {debugMode && (
              <>
                <div>face: {faceDetected ? "yes" : "no"}</div>
                {scores && (
                  <div>
                    smile {scores.smile.toFixed(2)} · frown {scores.frown.toFixed(2)} · browDown{" "}
                    {scores.browDown.toFixed(2)} · browUp {scores.browInnerUp.toFixed(2)} · jaw{" "}
                    {scores.jawOpen.toFixed(2)} · blink {scores.blink.toFixed(2)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={status === "running" ? stop : start}
        className="gradient-brand text-black font-semibold px-8 py-3 rounded-full shadow-lg shadow-orange-900/20 transition-shadow hover:shadow-xl"
      >
        {status === "running" ? t("camera.stop") : t("camera.start")}
      </motion.button>
    </div>
  );
}
