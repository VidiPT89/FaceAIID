"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useDebugMode } from "@/lib/debugMode";
import {
  classifyHandGesture,
  computeHandDebugInfo,
  correctAspect,
  fuseWithModel,
  HandGestureStabilizer,
  type HandDebugInfo,
  type HandGesture,
} from "@/lib/gestures/handGestures";
import { getGestureRecognizer } from "@/lib/mediapipe/gestureRecognizer";
import { useCameraLoop } from "@/lib/useCameraLoop";
import { prepareMirroredFrame } from "@/lib/canvas";
import CameraStage, { Badge, BadgeRow } from "@/components/CameraStage";

type GestureRecognizer = import("@mediapipe/tasks-vision").GestureRecognizer;
type DrawingUtils = import("@mediapipe/tasks-vision").DrawingUtils;
type Handedness = "left" | "right" | "unknown";

interface DetectedHand {
  gesture: HandGesture;
  handedness: Handedness;
}

const gestureLabelKey: Record<Exclude<HandGesture, "none">, string> = {
  thumbsUp: "gesture.thumbsUp",
  thumbsDown: "gesture.thumbsDown",
  openPalm: "gesture.openPalm",
  closedFist: "gesture.closedFist",
  peaceSign: "gesture.peaceSign",
  pointing: "gesture.pointing",
  threeFingers: "gesture.threeFingers",
  shaka: "gesture.shaka",
  iLoveYou: "gesture.iLoveYou",
  letterA: "gesture.letterA",
  letterD: "gesture.letterD",
  letterF: "gesture.letterF",
  letterI: "gesture.letterI",
  letterL: "gesture.letterL",
  letterO: "gesture.letterO",
  rockOn: "gesture.rockOn",
  letterB: "gesture.letterB",
  letterU: "gesture.letterU",
  fingersCrossed: "gesture.fingersCrossed",
};

const handsKey = (hands: DetectedHand[]) => hands.map((h) => `${h.handedness}-${h.gesture}`).join("|");

export default function CameraFeed() {
  const { t } = useLanguage();
  const { debugMode } = useDebugMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const connectionsRef = useRef<{ start: number; end: number }[]>([]);
  // One stabilizer per tracked hand slot (by array position — MediaPipe
  // doesn't give hands a stable identity across frames).
  const stabilizersRef = useRef<HandGestureStabilizer[]>([]);
  const handsKeyRef = useRef("");
  const debugModeRef = useRef(debugMode);

  const [hands, setHands] = useState<DetectedHand[]>([]);
  const [handDebug, setHandDebug] = useState<HandDebugInfo | null>(null);
  const [handModel, setHandModel] = useState<string | null>(null);

  useEffect(() => {
    debugModeRef.current = debugMode;
  }, [debugMode]);

  const prepare = useCallback(async () => {
    recognizerRef.current = await getGestureRecognizer();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) throw new Error("canvas 2D context unavailable");
    const { DrawingUtils, GestureRecognizer } = await import("@mediapipe/tasks-vision");
    drawingUtilsRef.current = new DrawingUtils(ctx);
    connectionsRef.current = GestureRecognizer.HAND_CONNECTIONS;
  }, []);

  const onFrame = useCallback((video: HTMLVideoElement) => {
    const canvas = canvasRef.current;
    const recognizer = recognizerRef.current;
    const drawingUtils = drawingUtilsRef.current;
    if (!canvas || !recognizer || !drawingUtils) return;

    const result = recognizer.recognizeForVideo(video, performance.now());
    const aspectRatio = video.videoWidth / video.videoHeight;
    const ctx = prepareMirroredFrame(canvas, video);

    const detectedHands: DetectedHand[] = [];
    let firstHandDebug: HandDebugInfo | null = null;
    let firstHandModel: string | null = null;
    try {
      result.landmarks.forEach((landmarks, i) => {
        drawingUtils.drawConnectors(landmarks, connectionsRef.current, { color: "#ffb703", lineWidth: 3 });
        drawingUtils.drawLandmarks(landmarks, { color: "#ff7a1a", fillColor: "#ff7a1a", radius: 4 });

        stabilizersRef.current[i] ??= new HandGestureStabilizer();
        const heuristic = classifyHandGesture(correctAspect(landmarks, aspectRatio));
      const gesture = stabilizersRef.current[i].push(fuseWithModel(heuristic, result.gestures[i]?.[0]));

        // MediaPipe's handedness assumes a mirrored (selfie) input image; the
        // frame is fed to the model un-mirrored (only the canvas is mirrored
        // at draw time), so the raw label is the opposite of what the user
        // sees — swap it so "left" means the hand that looks like your left.
        const rawLabel = result.handedness?.[i]?.[0]?.categoryName;
        const handedness: Handedness = rawLabel === "Left" ? "right" : rawLabel === "Right" ? "left" : "unknown";

        detectedHands.push({ gesture, handedness });
        if (i === 0) {
          const model = result.gestures[i]?.[0];
          firstHandDebug = computeHandDebugInfo(correctAspect(landmarks, aspectRatio));
          firstHandModel = model ? `${model.categoryName} ${model.score.toFixed(2)} → ${heuristic}` : null;
        }
      });
      stabilizersRef.current.length = detectedHands.length;
    } finally {
      ctx.restore();
    }

    // Only re-render when what's displayed actually changed, not on every
    // one of ~60 frames per second.
    const key = handsKey(detectedHands);
    if (key !== handsKeyRef.current) {
      handsKeyRef.current = key;
      setHands(detectedHands);
    }
    if (debugModeRef.current) {
      setHandDebug(firstHandDebug);
      setHandModel(firstHandModel);
    }
  }, []);

  const onStop = useCallback(() => {
    stabilizersRef.current = [];
    handsKeyRef.current = "";
    setHands([]);
    setHandDebug(null);
    setHandModel(null);
  }, []);

  const camera = useCameraLoop({ prepare, onFrame, onStop });
  const recognized = hands.filter((h): h is DetectedHand & { gesture: Exclude<HandGesture, "none"> } => h.gesture !== "none");

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <CameraStage
        camera={camera}
        idleText={t("hero.subtitle")}
        canvas={<canvas ref={canvasRef} className="w-full h-full object-cover" />}
        badges={
          <BadgeRow show={recognized.length > 0} animationKey={handsKey(recognized)} vertical>
            {recognized.map((h, i) => (
              <Badge key={i}>
                {h.handedness !== "unknown" && `${t(`hand.${h.handedness}`)} — `}
                {t(gestureLabelKey[h.gesture])}
              </Badge>
            ))}
          </BadgeRow>
        }
        debugLines={
          debugMode && (
            <>
              <div>hands: {hands.length}</div>
              {handDebug && (
                <div>
                  thumb {handDebug.thumbAngle.toFixed(0)}° ({handDebug.thumbExtended ? "out" : "in"}) · pinch{" "}
                  {handDebug.pinch.toFixed(2)}
                </div>
              )}
              {handModel && <div>model {handModel}</div>}
            </>
          )
        }
      />
    </div>
  );
}
