export type FacialExpression = "smile" | "sad" | "surprised" | "angry" | "blink" | "none";

interface Blendshape {
  categoryName: string;
  score: number;
}

function score(blendshapes: Blendshape[], name: string): number {
  return blendshapes.find((b) => b.categoryName === name)?.score ?? 0;
}

export function classifyFacialExpression(blendshapes: Blendshape[]): FacialExpression {
  if (!blendshapes || blendshapes.length === 0) return "none";

  const smileL = score(blendshapes, "mouthSmileLeft");
  const smileR = score(blendshapes, "mouthSmileRight");
  const frownL = score(blendshapes, "mouthFrownLeft");
  const frownR = score(blendshapes, "mouthFrownRight");
  const browDownL = score(blendshapes, "browDownLeft");
  const browDownR = score(blendshapes, "browDownRight");
  const browInnerUp = score(blendshapes, "browInnerUp");
  const jawOpen = score(blendshapes, "jawOpen");
  const eyeWideL = score(blendshapes, "eyeWideLeft");
  const eyeWideR = score(blendshapes, "eyeWideRight");
  const eyeBlinkL = score(blendshapes, "eyeBlinkLeft");
  const eyeBlinkR = score(blendshapes, "eyeBlinkRight");
  const noseSneerL = score(blendshapes, "noseSneerLeft");
  const noseSneerR = score(blendshapes, "noseSneerRight");
  const mouthPressL = score(blendshapes, "mouthPressLeft");
  const mouthPressR = score(blendshapes, "mouthPressRight");

  // Thresholds are deliberately forgiving: MediaPipe's blendshape scores
  // rarely hit "textbook" values for a natural (not exaggerated) expression,
  // and requiring both sides of the face to independently clear a high bar
  // made most real expressions register as "none".
  const browDownAvg = (browDownL + browDownR) / 2;
  const eyeWideMax = Math.max(eyeWideL, eyeWideR);
  const frownMax = Math.max(frownL, frownR);
  const smileMax = Math.max(smileL, smileR);
  const noseSneerMax = Math.max(noseSneerL, noseSneerR);
  const mouthPressMax = Math.max(mouthPressL, mouthPressR);

  const surprised = browInnerUp > 0.3 && jawOpen > 0.15 && eyeWideMax > 0.15;
  const angry = browDownAvg > 0.3 && (noseSneerMax > 0.12 || mouthPressMax > 0.2 || browDownAvg > 0.45);
  const sad = frownMax > 0.22 && !surprised;
  const smile = smileMax > 0.3 && jawOpen < 0.5;
  const blink = eyeBlinkL > 0.5 && eyeBlinkR > 0.5;

  if (surprised) return "surprised";
  if (angry) return "angry";
  if (sad) return "sad";
  if (smile) return "smile";
  if (blink) return "blink";
  return "none";
}
