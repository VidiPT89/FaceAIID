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

  const surprised = browInnerUp > 0.5 && jawOpen > 0.3 && (eyeWideL > 0.3 || eyeWideR > 0.3);
  const angry = (browDownL > 0.5 && browDownR > 0.5) && (noseSneerL > 0.2 || noseSneerR > 0.2 || mouthPressL > 0.3 || mouthPressR > 0.3);
  const sad = (frownL > 0.4 || frownR > 0.4) && (browDownL > 0.2 || browDownR > 0.2) && !surprised;
  const smile = (smileL > 0.5 || smileR > 0.5) && jawOpen < 0.4;
  const blink = eyeBlinkL > 0.6 && eyeBlinkR > 0.6;

  if (surprised) return "surprised";
  if (angry) return "angry";
  if (sad) return "sad";
  if (smile) return "smile";
  if (blink) return "blink";
  return "none";
}
