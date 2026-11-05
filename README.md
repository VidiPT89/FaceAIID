# 🖐️ FaceAIID

> Real-time hand gesture, facial expression and head movement recognition running entirely in the browser, built with Next.js and MediaPipe.

[Live Demo](https://faceaiid.vercel.app) · [Report Bug](https://github.com/VidiPT89/FaceAIID/issues) · [Request Feature](https://github.com/VidiPT89/FaceAIID/issues)

## ✨ Features

- ✅ Live hand gesture recognition for **multiple hands at once**, each labeled as your left/right hand (mirror-corrected) — thumbs up/down, open palm, closed fist, peace sign, crossed fingers, pointing, three fingers (W), shaka, rock on, the ASL/LGP "I love you" sign, OK, and the fingerspelling letters A, B, D, F, I, L, O and U
- ✅ Two layers for hands: MediaPipe's **trained GestureRecognizer model** for the 7 gestures it knows, combined with hand-coded finger-geometry rules for the rest. Measured on MediaPipe's own test photos, the rules alone misread a fist as "O" and a pointing finger as "D"/"L"; the combination gets every one of them right, and a relaxed half-open hand reads as "nothing" instead of a wrong letter
- ✅ A curated set of static ASL/LGP-inspired hand shapes — **not** full sign-language recognition, and **not** the full fingerspelling alphabet. Real sign language (and letters such as C, J or Z) needs a sequence model trained on real examples
- ✅ Facial expression recognition from 52 MediaPipe blendshapes — smile, laugh, sad, surprised, angry, kiss, puffed cheeks, mouth open, raised eyebrows, wink and eyes closed — measured against each person's own neutral face, so it adapts to different faces. Tongue-out is **not** detected: the blendshapes don't track the tongue
- ✅ Head movement recognition — nodding yes, shaking no, head tilt, and looking left/right/up/down — from the face's 3D transformation matrix
- ✅ Face identification — register a face (several samples from different angles) and get recognized afterwards, entirely client-side (face-api.js with the SSD MobileNet detector), stored only in `localStorage`. A name is only shown when it wins several frames in a row, clearly beats any other registered person, and the face is seen clearly enough
- ✅ On-device inference throughout — MediaPipe Tasks Vision + face-api.js, no video or biometric data ever leaves the browser
- ✅ Animated hand-landmark / face-contour overlays drawn in real time on canvas
- ✅ Smooth, fluid UI animations powered by Framer Motion, including an animated splash screen
- ✅ Runtime language switch — Português (PT-PT) and English
- ✅ Dark mode, Light mode, and System mode
- ✅ Custom color identity inspired by [ividi.dev](https://ividi.dev/) — burnt orange, amber and near-black
- ✅ Fully responsive, camera-first layout

## 🛠️ Tech Stack

| Category   | Technology                     |
|------------|----------------------------------|
| Framework  | Next.js 16 (App Router)          |
| Language   | TypeScript                        |
| Styling    | Tailwind CSS                      |
| Animation  | Framer Motion                     |
| Vision     | MediaPipe Tasks Vision (Gesture Recognizer + Face Landmarker) |
| Face ID    | @vladmandic/face-api (self-hosted models) |

## 🚀 Quick Start

**Prerequisites**
- Node.js 20+
- A webcam and a browser with camera permissions

**Steps**

```bash
git clone https://github.com/VidiPT89/FaceAIID.git
cd FaceAIID
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and allow camera access.

## 📖 Usage

Pick a mode from the header — **Hands**, **Face**, or **Identification** — press **Start camera**, allow
the permission prompt, and:

- **Hands**: show one or both hands to get a shape recognized per hand (with a left/right label) in an
  animated badge, with the full hand skeleton drawn live over the feed.
- **Face**: start with a relaxed face for a second (the app learns your neutral face), then smile, laugh,
  pout a kiss, puff your cheeks, wink, nod, shake your head or look around — the detected expression and
  head movement show up as badges, with the face mesh drawn live.
- **Identification**: type a name and press **Register face** to store your face descriptor locally, then
  the app recognizes you (or shows "not recognized"). Registration only accepts a clear, frontal view. The name stays filled, so pressing again saves extra samples (up to 5) from other angles or lighting for more reliable matching. Everything stays in this
  browser's `localStorage` — nothing is ever uploaded.

Switch language and appearance at any time from the header. The 🐞 button shows the live numbers behind
each decision (finger angles, the model's answer, blendshape scores, head angles) — useful to see why
something was or wasn't recognized.

## 🧪 Testing

```bash
npm run build
npm run lint
npm run test
```

Unit tests ([Vitest](https://vitest.dev)) cover the pure gesture, expression and head classifiers in `src/lib/gestures/` — including landmarks MediaPipe produced on its own public test photos (`tests/fixtures/mediapipe-real.json`), so the rules are checked against real hands and faces, not only synthetic ones — the local face store (sample cap, matching, corrupted or unwritable storage) and that the MediaPipe WASM loaded from the CDN matches the installed `@mediapipe/tasks-vision` version — no camera or browser needed.

`@mediapipe/tasks-vision` is pinned to an exact version on purpose: when upgrading it, update `MEDIAPIPE_WASM_VERSION` in `src/lib/mediapipe/vision.ts` too (the test above fails until both match).

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

## 👨‍💻 Author

**David Arsénio Martins**

🌐 Website: [ividi.dev](https://ividi.dev/)
🐙 GitHub: [@VidiPT89](https://github.com/VidiPT89/)

## 🤝 Contributing

Contributions, issues and feature requests are welcome. Feel free to check the [issues page](https://github.com/VidiPT89/FaceAIID/issues).

---

<p align="center">Developed by <a href="https://ividi.dev">David Arsénio Martins</a></p>
<p align="center">If you like this project, consider giving it a ⭐</p>
