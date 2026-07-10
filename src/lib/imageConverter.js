/**
 * Client-side image conversion using the Canvas API. No dependencies, no network.
 *
 * Decoding: we prefer `createImageBitmap` (fast, off-thread, and can bake in EXIF
 * orientation) and fall back to an <img> element for formats/browsers where
 * createImageBitmap is unreliable (notably SVG).
 *
 * Encoding: `canvas.toBlob` / `OffscreenCanvas.convertToBlob` can reliably produce
 * PNG, JPEG and WebP across modern Chrome, Firefox and Safari. Formats that the
 * canvas cannot encode (e.g. GIF, AVIF) are handled by the ffmpeg engine instead.
 */

import { log } from "./logger.js";

// Output format -> MIME type that canvas can encode.
export const CANVAS_OUTPUT_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

// Formats a JPEG-style lossy encoder should get a quality hint for.
const LOSSY = new Set(["jpg", "webp"]);

/** Fill color used when flattening transparency into a format without an alpha channel. */
const FLATTEN_BG = "#ffffff";

// Browser canvas ceilings: Chrome caps a single dimension at 16384px and the
// total area at ~268 MP. Beyond these the canvas silently yields a blank image,
// so we downscale proportionally instead of erroring or producing garbage.
const MAX_SIDE = 16384;
const MAX_AREA = 16384 * 16384;

// Raster size used when an input has no intrinsic dimensions (e.g. a sizeless SVG).
const DEFAULT_RASTER = 1024;

/** Fit (width,height) within the canvas limits, preserving aspect ratio. */
function clampDimensions(width, height) {
  const scale = Math.min(
    1,
    MAX_SIDE / Math.max(width, height),
    Math.sqrt(MAX_AREA / (width * height))
  );
  if (scale >= 1) return { width, height };
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

/** Best-effort intrinsic size for inputs that decode with zero dimensions. */
async function fallbackDimensions(file) {
  try {
    if (/svg/i.test(file.type) || /\.svg$/i.test(file.name || "")) {
      const text = await file.text();
      const m = text.match(
        /viewBox\s*=\s*["']\s*[-\d.eE]+\s+[-\d.eE]+\s+([\d.eE]+)\s+([\d.eE]+)/i
      );
      if (m) {
        const w = parseFloat(m[1]);
        const h = parseFloat(m[2]);
        if (w > 0 && h > 0) {
          const s = DEFAULT_RASTER / Math.max(w, h);
          return { width: Math.round(w * s), height: Math.round(h * s) };
        }
      }
    }
  } catch {
    /* fall through to a square default */
  }
  return { width: DEFAULT_RASTER, height: DEFAULT_RASTER };
}

function decodeWithImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image format can't be decoded by your browser."));
    };
    img.decoding = "async";
    img.src = url;
  });
}

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      // Fall through to the <img> path (e.g. SVG, or older Safari).
    }
  }
  return decodeWithImageElement(file);
}

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas === "function") {
    return { canvas: new OffscreenCanvas(width, height), offscreen: true };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, offscreen: false };
}

function toBlob(canvas, offscreen, mime, quality) {
  if (offscreen) {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed."))),
      mime,
      quality
    );
  });
}

/**
 * Convert an image File to another format entirely in the browser.
 *
 * @param {File} file
 * @param {string} targetFormat  one of the CANVAS_OUTPUT_MIME keys ("png"|"jpg"|"webp")
 * @param {object} [opts]
 * @param {number} [opts.quality=0.92]  0..1, applies to lossy outputs
 * @param {(p:number)=>void} [opts.onProgress]
 * @returns {Promise<Blob>}
 */
export async function convertImage(file, targetFormat, opts = {}) {
  const { quality = 0.92, onProgress } = opts;
  const mime = CANVAS_OUTPUT_MIME[targetFormat];
  if (!mime) {
    throw new Error(`Canvas can't encode "${targetFormat}".`);
  }

  onProgress?.(0.1);
  const decoded = await decode(file);
  const { source, cleanup } = decoded;

  try {
    // Resolve target dimensions. Some inputs (notably sizeless SVGs that carry
    // only a viewBox) decode with zero intrinsic size — fall back sensibly
    // rather than failing on a supported input.
    let { width, height } = decoded;
    if (!width || !height) {
      ({ width, height } = await fallbackDimensions(file));
    }
    // Keep the canvas within browser limits so huge images don't silently
    // produce a blank result.
    ({ width, height } = clampDimensions(width, height));
    onProgress?.(0.4);

    const { canvas, offscreen } = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is unavailable.");

    // Formats without alpha need a solid background, otherwise transparent
    // pixels render as black.
    if (targetFormat === "jpg") {
      ctx.fillStyle = FLATTEN_BG;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(source, 0, 0, width, height);
    onProgress?.(0.7);

    const blob = await toBlob(canvas, offscreen, mime, LOSSY.has(targetFormat) ? quality : undefined);

    // Browsers silently substitute PNG when they can't encode the requested type
    // (e.g. WebP on Safari < 17). Never hand back a file mislabeled by extension.
    if (blob.type && blob.type !== mime) {
      log.error("image", `browser fell back to ${blob.type} instead of ${mime}`);
      throw new Error(`Your browser can't encode ${targetFormat.toUpperCase()} images.`);
    }

    log.info("image", `canvas encode ok → ${targetFormat}`, {
      canvas: `${width}×${height}`,
      offscreen,
      outBytes: blob.size,
    });
    onProgress?.(1);
    return blob;
  } finally {
    cleanup?.();
  }
}
