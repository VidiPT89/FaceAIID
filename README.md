# 🖐️ FaceAIID

> Real-time hand gesture, facial expression and head movement recognition running entirely in the browser, built with Next.js and MediaPipe.

[Live Demo](https://faceaiid.vercel.app) · [Report Bug](https://github.com/VidiPT89/FaceAIID/issues) · [Request Feature](https://github.com/VidiPT89/FaceAIID/issues)

## ✨ Features

- ✅ Live hand gesture recognition for **multiple hands at once**, each labeled as your left/right hand (mirror-corrected) — thumbs up/down, open palm, closed fist, peace sign, pointing, three fingers (W), shaka, rock on, the ASL/LGP "I love you" sign, and the fingerspelling letters A, D, F, I, L and O
- ✅ A curated set of static ASL/LGP-inspired hand shapes — **not** full sign-language recognition, and **not** the full fingerspelling alphabet. Real sign language (and most fingerspelling letters, e.g. B, C, J, Z) needs a sequence model trained on real examples or a way to measure finger curvature/overlap this classifier doesn't attempt — this app only recognizes the handful of shapes above, each hand-coded from its finger angles
- ✅ Facial expression recognition — smile, sad, surprised, angry, blinking — via 52 MediaPipe blendshapes. Tongue-out is **not** detected: MediaPipe's face blendshapes don't track the tongue at all, so there's no signal to build this on
- ✅ Head movement recognition — nodding yes, shaking no, head tilt — from the face's 3D transformation matrix
- ✅ Face identification — register a face and get recognized afterwards, entirely client-side (face-api.js), stored only in `localStorage`
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
| Vision     | MediaPipe Tasks Vision (Hand + Face Landmarker) |
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
- **Face**: smile, frown, look surprised, nod or shake your head — the detected expression and head
  movement show up as badges, with the face contour drawn live.
- **Identification**: type a name and press **Register face** to store your face descriptor locally, then
  the app recognizes you (or shows "not recognized") on every subsequent frame. Everything stays in this
  browser's `localStorage` — nothing is ever uploaded.

Switch language and appearance at any time from the header.

## 🧪 Testing

```bash
npm run build
npm run lint
npm run test
```

Unit tests ([Vitest](https://vitest.dev)) cover the pure gesture and expression classifiers in `src/lib/gestures/` — no camera or browser needed, since those are the parts most sensitive to threshold/geometry regressions.

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
