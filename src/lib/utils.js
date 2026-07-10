/** Small formatting / helper utilities shared across the UI. */

/** Human-readable byte size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes, decimals = 1) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${sizes[i]}`;
}

/** Percentage delta between two byte sizes (negative = smaller). */
export function sizeDelta(from, to) {
  if (!from || !to) return null;
  return Math.round(((to - from) / from) * 100);
}

/** Collision-resistant enough id for client-side list keys (no crypto dependency). */
let _counter = 0;
export function uid() {
  _counter += 1;
  return `f${Date.now().toString(36)}${_counter.toString(36)}`;
}

/** Strip the extension from a filename, keeping any leading dots in the base. */
export function baseName(filename) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

/** clsx-lite: join truthy class strings. */
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
