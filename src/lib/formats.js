/**
 * Format registry + compatibility matrix.
 *
 * Every output format has metadata (label, extension, MIME). `getOutputOptions`
 * maps an input (category + format) to the list of allowed targets, each tagged
 * with the engine that will perform the conversion:
 *   - "canvas" — HTML5 Canvas API (images only; PNG/JPG/WebP)
 *   - "ffmpeg" — @ffmpeg/ffmpeg WebAssembly (audio, video, GIF, TIFF decode)
 *
 * Codec choices below reflect what the default @ffmpeg/core@0.12 build ships:
 * libx264, libvpx-vp9, libmp3lame, libvorbis, libopus, native aac, flac, gif,
 * libwebp. (No libfdk_aac, no AV1 encoder.)
 */

/** @typedef {'image'|'audio'|'video'|'unknown'} Category */

export const FORMAT_META = {
  // images
  png: { label: "PNG", ext: "png", mime: "image/png" },
  jpg: { label: "JPG", ext: "jpg", mime: "image/jpeg" },
  webp: { label: "WebP", ext: "webp", mime: "image/webp" },
  // video
  mp4: { label: "MP4 · H.264", ext: "mp4", mime: "video/mp4" },
  webm: { label: "WebM · VP9", ext: "webm", mime: "video/webm" },
  gif: { label: "GIF", ext: "gif", mime: "image/gif" },
  // audio
  mp3: { label: "MP3", ext: "mp3", mime: "audio/mpeg" },
  wav: { label: "WAV", ext: "wav", mime: "audio/wav" },
  ogg: { label: "OGG · Vorbis", ext: "ogg", mime: "audio/ogg" },
  m4a: { label: "M4A · AAC", ext: "m4a", mime: "audio/mp4" },
  flac: { label: "FLAC", ext: "flac", mime: "audio/flac" },
  opus: { label: "Opus", ext: "opus", mime: "audio/ogg" },
};

// Image inputs the browser Canvas can decode (createImageBitmap / <img>).
const CANVAS_DECODABLE = new Set(["png", "jpg", "webp", "gif", "bmp", "avif", "svg", "ico"]);

// Canvas can encode these image targets.
const CANVAS_IMAGE_TARGETS = ["png", "jpg", "webp"];

// Standard target sets by category (order = preference in the dropdown).
const VIDEO_TARGETS = ["mp4", "webm", "gif", "mp3"];
const AUDIO_TARGETS = ["mp3", "wav", "ogg", "m4a", "flac", "opus"];

function meta(format) {
  return FORMAT_META[format] || { label: format.toUpperCase(), ext: format, mime: "application/octet-stream" };
}

function option(format, engine) {
  return { value: format, label: meta(format).label, engine };
}

/**
 * Allowed output options for a given input.
 * @param {Category} category
 * @param {string} inputFormat  normalized (e.g. "png", "mp4")
 * @returns {{value:string,label:string,engine:string}[]}
 */
export function getOutputOptions(category, inputFormat) {
  const input = (inputFormat || "").toLowerCase();

  if (category === "image") {
    // TIFF isn't decodable by canvas cross-browser — route it through ffmpeg.
    if (input === "tiff") {
      return CANVAS_IMAGE_TARGETS.map((f) => option(f, "ffmpeg"));
    }
    // Animated GIF: offer static frames (canvas) AND animation-preserving video (ffmpeg).
    if (input === "gif") {
      return [
        ...CANVAS_IMAGE_TARGETS.filter((f) => f !== "gif").map((f) => option(f, "canvas")),
        option("mp4", "ffmpeg"),
        option("webm", "ffmpeg"),
      ];
    }
    if (CANVAS_DECODABLE.has(input)) {
      return CANVAS_IMAGE_TARGETS.filter((f) => f !== input).map((f) => option(f, "canvas"));
    }
    // e.g. HEIC — no reliable client-side decoder in the default engine.
    return [];
  }

  if (category === "video") {
    return VIDEO_TARGETS.filter((f) => f !== input).map((f) => option(f, "ffmpeg"));
  }

  if (category === "audio") {
    return AUDIO_TARGETS.filter((f) => f !== input).map((f) => option(f, "ffmpeg"));
  }

  return [];
}

/** First (preferred) output format for an input, or "" if none. */
export function getDefaultOutput(category, inputFormat) {
  const opts = getOutputOptions(category, inputFormat);
  return opts.length ? opts[0].value : "";
}

export function getFormatMeta(format) {
  return FORMAT_META[format] || null;
}

/**
 * ffmpeg argument array for a conversion, EXCLUDING the leading `-i <input>` and
 * the trailing output filename (the ffmpeg client adds those). Tuned for the
 * single-thread wasm core: fast presets, VBR/CRF, downscale-friendly.
 *
 * @param {Category} _category
 * @param {string} _input
 * @param {string} output
 * @returns {string[]}
 */
export function getFfmpegArgs(_category, _input, output) {
  switch (output) {
    // ---- Video targets ----
    case "mp4":
      return [
        // Force even dimensions (yuv420p / H.264 requirement) without upscaling.
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
      ];
    case "webm":
      return [
        "-c:v", "libvpx-vp9",
        "-crf", "33",
        "-b:v", "0",
        "-deadline", "good",
        "-cpu-used", "5",
        "-row-mt", "1",
        "-c:a", "libopus",
        "-b:a", "128k",
      ];
    case "gif":
      return [
        "-filter_complex",
        "[0:v] fps=15,scale=480:-1:flags=lanczos,split [a][b];" +
          "[a] palettegen=max_colors=256 [p];" +
          "[b][p] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
        "-loop", "0",
      ];

    // ---- Audio targets (-vn drops any video/cover-art stream) ----
    case "mp3":
      return ["-vn", "-c:a", "libmp3lame", "-q:a", "2"];
    case "wav":
      return ["-vn", "-c:a", "pcm_s16le"];
    case "ogg":
      return ["-vn", "-c:a", "libvorbis", "-q:a", "5"];
    case "m4a":
      return ["-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"];
    case "flac":
      return ["-vn", "-c:a", "flac"];
    case "opus":
      return ["-vn", "-c:a", "libopus", "-b:a", "128k"];

    // ---- Image targets via ffmpeg (e.g. TIFF -> …) ----
    case "png":
      return [];
    case "jpg":
      return ["-q:v", "3"];
    case "webp":
      return ["-c:v", "libwebp", "-quality", "90"];

    default:
      return [];
  }
}
