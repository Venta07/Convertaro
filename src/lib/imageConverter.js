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
  const { source, width, height, cleanup } = await decode(file);

  try {
    if (!width || !height) throw new Error("The image has no readable dimensions.");
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
    onProgress?.(1);
    return blob;
  } finally {
    cleanup?.();
  }
}
