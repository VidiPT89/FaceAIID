export type FacialExpression = "smile" | "sad" | "surprised" | "angry" | "blink" | "none";

interface Blendshape {
  categoryName: string;
  score: number;
}

export interface ExpressionScores {
  smile: number;
  frown: number;
  browDown: number;
  browInnerUp: number;
  jawOpen: number;
  eyeWide: number;
  blink: number;
}

function score(blendshapes: Blendshape[], name: string): number {
  return blendshapes.find((b) => b.categoryName === name)?.score ?? 0;
}

export function computeExpressionScores(blendshapes: Blendshape[]): ExpressionScores {
  const smileL = score(blendshapes, "mouthSmileLeft");
  const smileR = score(blendshapes, "mouthSmileRight");
  const frownL = score(blendshapes, "mouthFrownLeft");
  const frownR = score(blendshapes, "mouthFrownRight");
  const browDownL = score(blendshapes, "browDownLeft");
  const browDownR = score(blendshapes, "browDownRight");
  const eyeWideL = score(blendshapes, "eyeWideLeft");
  const eyeWideR = score(blendshapes, "eyeWideRight");
  const eyeBlinkL = score(blendshapes, "eyeBlinkLeft");
  const eyeBlinkR = score(blendshapes, "eyeBlinkRight");

  return {
    smile: Math.max(smileL, smileR),
    frown: Math.max(frownL, frownR),
    browDown: (browDownL + browDownR) / 2,
    browInnerUp: score(blendshapes, "browInnerUp"),
    jawOpen: score(blendshapes, "jawOpen"),
    eyeWide: Math.max(eyeWideL, eyeWideR),
    blink: Math.min(eyeBlinkL, eyeBlinkR),
  };
}

/**
 * Thresholds are deliberately forgiving: MediaPipe's blendshape scores
 * rarely hit "textbook" values for a natural (not exaggerated) expression,
 * and requiring a high bar made most real expressions register as "none".
 * `computeExpressionScores` is exposed separately so a debug overlay can
 * show the live numbers if these still need recalibrating — that's a much
 * faster feedback loop than guessing at thresholds blind again.
 */
export function classifyFacialExpression(blendshapes: Blendshape[]): FacialExpression {
  if (!blendshapes || blendshapes.length === 0) return "none";

  const s = computeExpressionScores(blendshapes);
  const noseSneerMax = Math.max(
    score(blendshapes, "noseSneerLeft"),
    score(blendshapes, "noseSneerRight"),
  );
  const mouthPressMax = Math.max(
    score(blendshapes, "mouthPressLeft"),
    score(blendshapes, "mouthPressRight"),
  );

  const surprised = s.browInnerUp > 0.25 && s.jawOpen > 0.12 && s.eyeWide > 0.12;
  const angry = s.browDown > 0.22 && (noseSneerMax > 0.1 || mouthPressMax > 0.15 || s.browDown > 0.35);
  const sad = s.frown > 0.15 && !surprised;
  const smile = s.smile > 0.2 && s.jawOpen < 0.5;
  const blink = s.blink > 0.4;

  if (surprised) return "surprised";
  if (angry) return "angry";
  if (sad) return "sad";
  if (smile) return "smile";
  if (blink) return "blink";
  return "none";
}
