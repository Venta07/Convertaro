/**
 * File-type detection. We derive a normalized lower-case format token (e.g. "jpg")
 * and a broad category ("image" | "audio" | "video" | "unknown") from the file's
 * extension first, then fall back to its MIME type. Extension is preferred because
 * browsers are inconsistent about the MIME type they attach to a dropped file.
 */

// Canonicalize a few interchangeable tokens so the format registry has one key per format.
const ALIAS = {
  jpeg: "jpg",
  jpe: "jpg",
  jfif: "jpg",
  tif: "tiff",
  heif: "heic",
  oga: "ogg",
  ogv: "ogg",
  mpg: "mpeg",
  mpe: "mpeg",
  m4v: "mp4",
  qt: "mov",
  htm: "html",
};

const IMAGE = new Set([
  "png", "jpg", "webp", "gif", "bmp", "avif", "tiff", "ico", "svg", "heic",
]);
const AUDIO = new Set([
  "mp3", "wav", "ogg", "m4a", "aac", "flac", "opus", "weba", "wma", "aiff", "amr",
]);
const VIDEO = new Set([
  "mp4", "webm", "mov", "mkv", "avi", "flv", "wmv", "3gp", "mpeg", "ts", "m2ts",
]);

function normalize(token) {
  const t = (token || "").toLowerCase().replace(/^\./, "").trim();
  return ALIAS[t] || t;
}

function extFromName(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : "";
}

function categoryOf(format, mime = "") {
  if (IMAGE.has(format)) return "image";
  if (AUDIO.has(format)) return "audio";
  if (VIDEO.has(format)) return "video";
  // Fall back to the MIME top-level type.
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "unknown";
}

/**
 * @param {File} file
 * @returns {{category: 'image'|'audio'|'video'|'unknown', format: string, mime: string}}
 */
export function detectFile(file) {
  const mime = file.type || "";
  let format = normalize(extFromName(file.name));

  // If there was no usable extension, derive one from the MIME subtype.
  if (!format && mime.includes("/")) {
    format = normalize(mime.split("/")[1].split(";")[0]);
    if (format === "jpeg") format = "jpg";
    if (format === "quicktime") format = "mov";
    if (format === "x-matroska") format = "mkv";
    if (format === "x-msvideo") format = "avi";
    if (format === "mpeg" && mime.startsWith("audio/")) format = "mp3";
  }

  return { category: categoryOf(format, mime), format, mime };
}
