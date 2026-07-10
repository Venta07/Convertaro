import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { log } from "./logger.js";

/**
 * Singleton wrapper around @ffmpeg/ffmpeg (v0.12).
 *
 * - Lazily downloads the WASM core once (with real download progress).
 * - Prefers the multi-threaded core when the page is cross-origin isolated,
 *   falling back to single-thread otherwise.
 * - Falls back across CDNs (jsDelivr → unpkg) if one is unreachable.
 * - Caches the resolved blob URLs so a cancel/reload doesn't re-download 30 MB.
 * - Serializes jobs and supports cancellation via terminate().
 * - Emits observable engine state and pipes ffmpeg logs into the app logger.
 */

const CORE_VERSION = "0.12.10";

// Single-thread is the reliable default: it loads on any host (no COOP/COEP
// needed) and avoids multi-thread deadlocks seen on some filter graphs (e.g. GIF
// output). Flip to true to opt into the faster multi-thread core when the page
// is cross-origin isolated.
const PREFER_MULTITHREAD = false;

// Set to "/ffmpeg" to fully self-host (see README). Takes priority over CDNs.
const CORE_BASE_OVERRIDE = null;

// IMPORTANT: the @ffmpeg/ffmpeg v0.12 worker is a *module* worker, so it loads
// the core via `import(coreURL).default` — which requires the ESM build. The UMD
// build has no default export and fails with "failed to import ffmpeg-core.js".
const CDN_BASES = (mt) => [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core${mt ? "-mt" : ""}@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core${mt ? "-mt" : ""}@${CORE_VERSION}/dist/esm`,
];

let ffmpeg = null;
let loadPromise = null;
let cachedConfig = null; // resolved blob URLs, reused across reloads
let queue = Promise.resolve();
let cancelRequested = false;

// Rolling capture of the most recent ffmpeg stderr lines, for error messages.
const recentFfmpegLogs = [];

// ---------- observable engine state ----------
const engineState = { status: "idle", mode: null, progress: 0, error: null };
const stateListeners = new Set();

function setEngineState(patch) {
  Object.assign(engineState, patch);
  for (const fn of stateListeners) {
    try {
      fn({ ...engineState });
    } catch {
      /* ignore bad listener */
    }
  }
}

export function subscribeEngine(fn) {
  stateListeners.add(fn);
  fn({ ...engineState });
  return () => stateListeners.delete(fn);
}

export function getEngineState() {
  return { ...engineState };
}

// ---------- loading ----------
export function isCrossOriginIsolated() {
  return typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated === true;
}

/**
 * Fetch a URL and return a same-origin blob URL, reporting real download
 * progress. We stream the body ourselves (reading it exactly once) instead of
 * @ffmpeg/util's toBlobURL progress mode, which double-reads the body and
 * corrupts the download ("body stream already read").
 */
async function fetchToBlobURL(url, mime, onProgress) {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const total = Number(res.headers.get("content-length")) || 0;
  if (!total || !res.body || typeof res.body.getReader !== "function") {
    const buf = await res.arrayBuffer();
    return URL.createObjectURL(new Blob([buf], { type: mime }));
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(received / total);
  }
  return URL.createObjectURL(new Blob(chunks, { type: mime }));
}

async function fetchBlobURL(fileName, mime, bases, onProgress) {
  let lastErr;
  for (const base of bases) {
    try {
      const blobUrl = await fetchToBlobURL(`${base}/${fileName}`, mime, onProgress);
      log.debug("engine", `fetched ${fileName}`, { from: base });
      return blobUrl;
    } catch (err) {
      lastErr = err;
      log.warn("engine", `couldn't fetch ${fileName} from ${base}, trying next`, err);
    }
  }
  throw lastErr || new Error(`Could not fetch ${fileName}`);
}

async function buildConfig(mt, onDownload) {
  const bases = CORE_BASE_OVERRIDE ? [`${CORE_BASE_OVERRIDE}${mt ? "-mt" : ""}`] : CDN_BASES(mt);
  const coreURL = await fetchBlobURL("ffmpeg-core.js", "text/javascript", bases);
  // The .wasm is the ~30 MB payload — drive the progress bar off it.
  const wasmURL = await fetchBlobURL("ffmpeg-core.wasm", "application/wasm", bases, onDownload);
  const config = { coreURL, wasmURL };
  if (mt) {
    config.workerURL = await fetchBlobURL("ffmpeg-core.worker.js", "text/javascript", bases);
  }
  return config;
}

function attachLogPipe(instance) {
  instance.on("log", ({ message }) => {
    if (!message) return;
    recentFfmpegLogs.push(message);
    if (recentFfmpegLogs.length > 60) recentFfmpegLogs.shift();
    // Surface only notable lines to avoid flooding the log with per-frame noise.
    if (/error|invalid|unable|failed|cannot|no such|not found|unsupported/i.test(message)) {
      log.warn("ffmpeg", message);
    }
  });
}

async function doLoad(mt, onDownload) {
  // Always use a fresh instance so a failed load (or a cancel) never leaves a
  // half-initialized worker around.
  const instance = new FFmpeg();
  attachLogPipe(instance);

  if (!cachedConfig) {
    log.info("engine", `downloading ${mt ? "multi" : "single"}-thread core v${CORE_VERSION}`);
    cachedConfig = await buildConfig(mt, onDownload);
  } else {
    log.debug("engine", "reusing cached core blobs (no re-download)");
  }
  await instance.load(cachedConfig);
  ffmpeg = instance;
  return instance;
}

function ensureLoaded(onStatus) {
  if (ffmpeg?.loaded) return Promise.resolve(ffmpeg);

  if (!loadPromise) {
    loadPromise = (async () => {
      const preferMt = PREFER_MULTITHREAD && isCrossOriginIsolated();
      const t0 = typeof performance !== "undefined" ? performance.now() : 0;
      setEngineState({ status: "loading", mode: preferMt ? "mt" : "st", progress: 0, error: null });
      log.info("engine", "loading conversion engine", {
        mode: preferMt ? "multi-thread" : "single-thread",
        crossOriginIsolated: isCrossOriginIsolated(),
      });

      const onDownload = (p) => {
        setEngineState({ progress: p });
        onStatus?.(p, `Downloading engine… ${Math.round(p * 100)}% (first time only)`);
      };

      try {
        const inst = await doLoad(preferMt, onDownload);
        const ms = Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0);
        setEngineState({ status: "ready", progress: 1 });
        log.info("engine", `engine ready (${preferMt ? "multi" : "single"}-thread) in ${ms}ms`);
        return inst;
      } catch (mtErr) {
        if (preferMt) {
          log.warn("engine", "multi-thread core failed, falling back to single-thread", mtErr);
          setEngineState({ status: "loading", mode: "st", progress: 0 });
          cachedConfig = null; // MT config is unusable; rebuild for ST
          try {
            const inst = await doLoad(false, onDownload);
            setEngineState({ status: "ready", progress: 1, mode: "st" });
            log.info("engine", "engine ready (single-thread fallback)");
            return inst;
          } catch (stErr) {
            throw stErr;
          }
        }
        throw mtErr;
      }
    })().catch((err) => {
      loadPromise = null;
      cachedConfig = null;
      setEngineState({ status: "error", error: err?.message || String(err) });
      log.error("engine", "engine failed to load", err);
      throw new Error(
        "Couldn't load the conversion engine. Check your connection and try again.",
        { cause: err }
      );
    });
  }
  return loadPromise;
}

// ---------- conversion ----------
/**
 * @param {object} job
 * @param {File|Blob} job.file
 * @param {string} job.inputName
 * @param {string} job.outputName
 * @param {string[]} job.args
 * @param {string} job.mime
 * @param {(progress:number, statusText?:string)=>void} [job.onProgress]
 * @returns {Promise<Blob>}
 */
export function ffmpegConvert(job) {
  const run = queue.then(() => runJob(job));
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function runJob({ file, inputName, outputName, args, mime, onProgress }) {
  const instance = await ensureLoaded((p, text) => onProgress?.(p, text));

  let lastLog = "";
  const onLog = ({ message }) => {
    if (message && message.trim()) lastLog = message;
  };
  const onProg = ({ progress }) => {
    if (typeof progress === "number" && progress > 0) {
      onProgress?.(Math.min(progress, 0.999), "Converting…");
    }
  };
  instance.on("log", onLog);
  instance.on("progress", onProg);

  const command = ["-i", inputName, ...args, outputName];
  log.info("convert", `ffmpeg ${command.join(" ")}`, {
    input: `${inputName} (${(file.size / 1048576).toFixed(2)} MB)`,
  });
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;

  try {
    onProgress?.(0.02, "Reading file…");
    await instance.writeFile(inputName, await fetchFile(file));

    onProgress?.(0.05, "Converting…");
    const code = await instance.exec(command);
    if (code !== 0) {
      throw new Error(cleanFfmpegError(lastLog) || `Conversion failed (code ${code}).`);
    }

    const data = await instance.readFile(outputName);
    if (!data || data.byteLength === 0) {
      throw new Error(cleanFfmpegError(lastLog) || "Conversion produced an empty file.");
    }

    const ms = Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0);
    log.info("convert", `done → ${outputName} (${(data.byteLength / 1048576).toFixed(2)} MB) in ${ms}ms`);
    onProgress?.(1, "Finishing…");
    return new Blob([data], { type: mime });
  } catch (err) {
    if (cancelRequested) {
      cancelRequested = false;
      log.warn("convert", "conversion canceled by user");
      const e = new Error("Canceled.");
      e.name = "CanceledError";
      throw e;
    }
    // wasm-level failures (OOM, decoder abort) REJECT instead of returning a
    // non-zero code, and the worker rejects with a plain string — normalize both.
    const raw = err instanceof Error ? err.message : String(err);
    log.error("convert", `conversion failed for ${outputName}`, {
      error: raw,
      tail: recentFfmpegLogs.slice(-8),
    });
    throw new Error(cleanFfmpegError(lastLog) || cleanFfmpegError(raw) || "Conversion failed.");
  } finally {
    instance.off?.("log", onLog);
    instance.off?.("progress", onProg);
    // deleteFile can throw if the worker was terminated (cancel) — ignore.
    await instance.deleteFile?.(inputName).catch(() => {});
    await instance.deleteFile?.(outputName).catch(() => {});
  }
}

/** Cancel the in-flight job by tearing down the worker; the core is re-used from cache. */
export async function cancelActiveJob() {
  if (!ffmpeg) return;
  cancelRequested = true;
  log.warn("engine", "terminating worker to cancel active job");
  try {
    await ffmpeg.terminate();
  } catch {
    /* ignore */
  }
  ffmpeg = null;
  loadPromise = null; // cachedConfig is kept, so reload reuses downloaded blobs
  setEngineState({ status: "idle", progress: 0 });
}

function cleanFfmpegError(logLine) {
  if (!logLine) return "";
  if (/Invalid data found|invalid data/i.test(logLine)) return "This file appears to be corrupt or in an unsupported format.";
  if (/No such file/i.test(logLine)) return "Could not read the input file.";
  if (/Cannot allocate memory|OOM|out of memory|memory access out of bounds|abort/i.test(logLine)) {
    return "Ran out of memory — try a smaller file or a lower-resolution output.";
  }
  if (/Requested output format .* is not|Unknown encoder|Encoder .* not found/i.test(logLine)) {
    return "That output format isn't supported by the conversion engine.";
  }
  return logLine.length > 180 ? `${logLine.slice(0, 180)}…` : logLine;
}

/** Warm up the engine ahead of the first conversion. */
export function preloadEngine(onStatus) {
  return ensureLoaded(onStatus).then(
    () => true,
    () => false
  );
}

export async function disposeEngine() {
  if (ffmpeg) {
    try {
      await ffmpeg.terminate();
    } catch {
      /* ignore */
    }
    ffmpeg = null;
    loadPromise = null;
  }
}
