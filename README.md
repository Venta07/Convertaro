# Convertaro

**A privacy-first universal file converter that runs 100% in your browser.**

Convert images, audio, and video without ever uploading a file. All processing
happens locally with WebAssembly ([`@ffmpeg/ffmpeg`](https://github.com/ffmpegwasm/ffmpeg.wasm))
for media and the HTML5 **Canvas API** for images. No server, no accounts, no
tracking — your files never leave your device.

<p align="center">
  <em>React + Vite · Tailwind CSS · ffmpeg.wasm · Canvas — MIT licensed</em>
</p>

---

## ✨ Features

- **Truly private** — conversions run on-device; nothing is uploaded.
- **Drag & drop** upload with automatic file-type detection (image / audio / video).
- **Smart format menu** — only shows output formats that are actually compatible
  with your input, and picks the right engine (Canvas vs ffmpeg) automatically.
- **Live progress bar** with per-file status and result size.
- **One-click download** of the converted file.
- **Dark mode**, responsive, minimalist UI.
- Works **offline** after first load (optionally fully self-hosted — see below).

### Supported conversions

| Input | Outputs | Engine |
| --- | --- | --- |
| PNG · JPG · WebP · BMP · AVIF · SVG · ICO | PNG, JPG, WebP | Canvas |
| GIF | PNG, JPG, WebP (frame) · MP4, WebM (animation) | Canvas / ffmpeg |
| TIFF | PNG, JPG, WebP | ffmpeg |
| MP4 · WebM · MOV · MKV · AVI · FLV · WMV · 3GP … | MP4 (H.264), WebM (VP9), GIF, MP3 | ffmpeg |
| MP3 · WAV · OGG · M4A · AAC · FLAC · OPUS · … | MP3, WAV, OGG, M4A (AAC), FLAC, Opus | ffmpeg |

> HEIC/HEIF and camera RAW have no reliable client-side decoder in the default
> engine and are reported as unsupported.

---

## 🚀 Getting started

**Prerequisites:** Node.js 18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (http://localhost:5173)
npm run dev

# 3. Production build + local preview
npm run build
npm run preview
```

That's it. Open the dev URL, drop in a file, choose a format, and convert.

---

## 🧠 How it works

```
File dropped ─▶ detect.js         → category (image/audio/video) + format
            ─▶ formats.js         → compatible outputs + engine per pair
            ─▶ convert.js         → routes to the right engine
                   ├─ imageConverter.js  (Canvas API: PNG/JPG/WebP)
                   └─ ffmpegClient.js     (ffmpeg.wasm: audio/video/GIF/TIFF)
```

- **Images** are decoded with `createImageBitmap` (EXIF-orientation aware) and
  re-encoded via `canvas.convertToBlob` / `toBlob`. Fast, dependency-free.
- **Audio/video** run through a single lazily-loaded ffmpeg.wasm instance. Jobs
  are serialized (one ffmpeg exec at a time) and the in-memory FS is cleaned up
  after each conversion.

### Threading & the core binary

The ffmpeg **core** (~30 MB wasm) is fetched once, on the first conversion. The
client feature-detects [cross-origin isolation](https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated):

- **Isolated** (COOP/COEP headers present) → uses the faster multi-threaded core.
- **Not isolated** → falls back to the single-thread core, which works anywhere.

The dev server and `vite preview` set these headers automatically
([`vite.config.js`](vite.config.js)). For production, replicate them on your host:

- **Netlify / Cloudflare Pages** — [`public/_headers`](public/_headers) is copied to the site root.
- **Vercel** — [`vercel.json`](vercel.json).
- **Nginx** — `add_header Cross-Origin-Opener-Policy "same-origin" always;` +
  `add_header Cross-Origin-Embedder-Policy "require-corp" always;`

Hosts that can't set headers (e.g. GitHub Pages) still work — the app just uses
the single-thread core.

### Full offline / self-hosted core

By default the core is loaded from jsDelivr (a cacheable, third-party CDN — your
files still never leave the browser). To remove that request entirely:

1. `npm i @ffmpeg/core@0.12.10 @ffmpeg/core-mt@0.12.10`
2. Copy their `dist/umd` files into `public/ffmpeg/` and `public/ffmpeg-mt/`.
3. In [`src/lib/ffmpegClient.js`](src/lib/ffmpegClient.js), set
   `CORE_BASE = (mt) => "/ffmpeg" + (mt ? "-mt" : "")`.

Now the app is 100% self-contained and works with no network at all.

---

## 🗂 Project structure

```
convertaro/
├─ index.html                 # app shell + no-flash theme script
├─ vite.config.js             # React, Tailwind, COOP/COEP, ffmpeg worker config
├─ public/
│  ├─ favicon.svg
│  └─ _headers                # COOP/COEP for Netlify/Cloudflare
├─ vercel.json                # COOP/COEP for Vercel
└─ src/
   ├─ main.jsx
   ├─ App.jsx                 # layout + wiring
   ├─ index.css               # Tailwind v4 + design tokens
   ├─ hooks/
   │  ├─ useTheme.js          # dark-mode state
   │  └─ useConverter.js      # queue, progress, object-URL lifecycle
   ├─ lib/
   │  ├─ detect.js            # file-type detection
   │  ├─ formats.js           # format registry + compatibility matrix + ffmpeg args
   │  ├─ convert.js           # engine dispatcher
   │  ├─ imageConverter.js    # Canvas image conversion
   │  ├─ ffmpegClient.js      # ffmpeg.wasm singleton
   │  └─ utils.js
   └─ components/
      ├─ Dropzone.jsx  FileCard.jsx  FormatSelect.jsx  ProgressBar.jsx
      └─ ThemeToggle.jsx  Header.jsx  Footer.jsx
```

---

## ⚠️ Notes & limits

- Everything runs in a wasm sandbox with a ~2–4 GB memory ceiling, so very large
  or 4K/long videos can be slow or run out of memory. Prefer smaller inputs; the
  video presets already downscale to even dimensions and use fast encoder presets.
- VP9 (WebM) encoding in wasm is CPU-heavy; expect it to be slower than H.264.
- Only the native `aac` encoder is available (no libfdk_aac), and there is **no
  AV1 encoder** in the default core.

## 📄 License

MIT — free to use, modify, and self-host.
