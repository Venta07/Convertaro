/**
 * Tiny structured logger. Every event goes to the browser console AND an
 * in-memory ring buffer that the in-app Diagnostics panel renders, so users can
 * see exactly what happened during a conversion and copy it into a bug report.
 */

const BUFFER_MAX = 800;

/** @typedef {'debug'|'info'|'warn'|'error'} LogLevel */

const buffer = [];
const listeners = new Set();
let seq = 0;

const CONSOLE_STYLE = {
  debug: "color:#64748b",
  info: "color:#6366f1;font-weight:600",
  warn: "color:#d97706;font-weight:600",
  error: "color:#dc2626;font-weight:700",
};

function safeData(data) {
  if (data === undefined) return undefined;
  if (data instanceof Error) return { name: data.name, message: data.message, stack: data.stack };
  try {
    // Round-trip to strip non-serializable bits but keep a readable snapshot.
    return JSON.parse(JSON.stringify(data));
  } catch {
    return String(data);
  }
}

function push(entry) {
  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer.shift();
  for (const fn of listeners) {
    try {
      fn(entry);
    } catch {
      /* a bad listener must not break logging */
    }
  }
}

function write(level, scope, message, data) {
  const entry = {
    id: ++seq,
    at: Date.now(),
    ts: (typeof performance !== "undefined" ? performance.now() : 0),
    level,
    scope,
    message,
    data: safeData(data),
  };
  push(entry);

  if (typeof console !== "undefined") {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    const label = `%c[Convertaro:${scope}]%c ${message}`;
    if (data !== undefined) fn(label, CONSOLE_STYLE[level], "color:inherit", data);
    else fn(label, CONSOLE_STYLE[level], "color:inherit");
  }
  return entry;
}

export const log = {
  /** @param {string} scope @param {string} message @param {*} [data] */
  debug: (scope, message, data) => write("debug", scope, message, data),
  info: (scope, message, data) => write("info", scope, message, data),
  warn: (scope, message, data) => write("warn", scope, message, data),
  error: (scope, message, data) => write("error", scope, message, data),

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getAll: () => buffer.slice(),
  clear() {
    buffer.length = 0;
    for (const fn of listeners) fn(null);
  },
  toText() {
    return buffer
      .map((e) => {
        const time = new Date(e.at).toISOString().slice(11, 23);
        const data = e.data !== undefined ? ` ${JSON.stringify(e.data)}` : "";
        return `${time} ${e.level.toUpperCase().padEnd(5)} [${e.scope}] ${e.message}${data}`;
      })
      .join("\n");
  },
};

/** One-time snapshot of the runtime environment — logged at startup. */
export function environmentInfo() {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  return {
    crossOriginIsolated:
      typeof globalThis !== "undefined" ? globalThis.crossOriginIsolated === true : false,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    hardwareConcurrency: nav.hardwareConcurrency || null,
    deviceMemory: nav.deviceMemory || null,
    offscreenCanvas: typeof OffscreenCanvas !== "undefined",
    createImageBitmap: typeof createImageBitmap === "function",
    userAgent: nav.userAgent || "",
    language: nav.language || "",
    origin: typeof location !== "undefined" ? location.origin : "",
  };
}
