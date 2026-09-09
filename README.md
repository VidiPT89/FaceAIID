# 🖐️ FaceAIID

> Real-time hand gesture, facial expression and head movement recognition running entirely in the browser, built with Next.js and MediaPipe.

[Report Bug](https://github.com/VidiPT89/FaceAIID/issues) · [Request Feature](https://github.com/VidiPT89/FaceAIID/issues)

## ✨ Features

- ✅ Live hand gesture recognition — thumbs up, open palm, closed fist — straight from your webcam
- ✅ On-device inference with MediaPipe Tasks Vision — no video ever leaves the browser
- ✅ Animated hand-landmark overlay drawn in real time on a canvas
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
| Vision     | MediaPipe Tasks Vision (HandLandmarker) |

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

Press **Start camera**, allow the permission prompt, and show your hand to the camera. The app draws the
detected hand landmarks live and surfaces the recognized gesture (👍 thumbs up, ✋ open palm, ✊ closed fist)
in an animated badge. Switch language and appearance at any time from the header.

## 🧪 Testing

```bash
npm run build
npm run lint
```

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
