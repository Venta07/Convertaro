import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * Thin singleton wrapper around @ffmpeg/ffmpeg (v0.12).
 *
 * The WebAssembly core is fetched once, lazily, on the first conversion. We
 * feature-detect cross-origin isolation and use the faster multi-threaded core
 * when it's available, transparently falling back to the single-thread core
 * (which works on any static host with no special headers).
 *
 * Privacy note: user files never leave the browser. The only network request is
 * for the ffmpeg core itself (a fixed, cacheable binary). To make the app fully
 * offline / self-hosted, copy the core files into `public/ffmpeg` and point
 * CORE_BASE at "/ffmpeg" — see README.
 */

// Pin the core version to the wrapper version (0.12.15 <-> 0.12.10).
const CORE_VERSION = "0.12.10";

// Where the core binaries come from. Swap to "/ffmpeg" (with -mt appended for the
// multi-thread build) if you self-host — see README "Full offline mode".
const CDN = (mt) =>
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core${mt ? "-mt" : ""}@${CORE_VERSION}/dist/umd`;
const CORE_BASE = CDN;

let ffmpeg = null;
let loadPromise = null;

// Serialize jobs: one ffmpeg instance can only run one exec at a time.
let queue = Promise.resolve();

function isCrossOriginIsolated() {
  return typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated === true;
}

async function buildConfig(mt) {
  const base = CORE_BASE(mt);
  const config = {
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  };
  if (mt) {
    config.workerURL = await toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript");
  }
  return config;
}

/** Ensure the core is loaded exactly once (with graceful MT -> ST fallback). */
function ensureLoaded(onStatus) {
  if (ffmpeg?.loaded) return Promise.resolve(ffmpeg);

  if (!loadPromise) {
    loadPromise = (async () => {
      onStatus?.("Loading converter engine…");
      const instance = ffmpeg || new FFmpeg();
      ffmpeg = instance;

      const preferMt = isCrossOriginIsolated();
      try {
        await instance.load(await buildConfig(preferMt));
      } catch (err) {
        if (preferMt) {
          // Multi-thread can be flaky on some browsers/inputs — retry single-thread.
          await instance.load(await buildConfig(false));
        } else {
          throw err;
        }
      }
      return instance;
    })().catch((err) => {
      // Allow a later retry after a failed load.
      loadPromise = null;
      throw new Error(
        "Couldn't load the conversion engine. Check your connection and try again."
      );
    });
  }
  return loadPromise;
}

/**
 * Run one ffmpeg conversion. Serialized behind a queue.
 *
 * @param {object} job
 * @param {File|Blob} job.file
 * @param {string} job.inputName    virtual FS input filename (extension matters)
 * @param {string} job.outputName   virtual FS output filename
 * @param {string[]} job.args       ffmpeg args between input and output
 * @param {string} job.mime         MIME type for the resulting Blob
 * @param {(progress:number, statusText?:string)=>void} [job.onProgress]
 * @returns {Promise<Blob>}
 */
export function ffmpegConvert(job) {
  const run = queue.then(() => runJob(job));
  // Keep the chain alive even if a job rejects.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function runJob({ file, inputName, outputName, args, mime, onProgress }) {
  const instance = await ensureLoaded((text) => onProgress?.(0, text));

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

  try {
    onProgress?.(0.02, "Reading file…");
    await instance.writeFile(inputName, await fetchFile(file));

    onProgress?.(0.05, "Converting…");
    const code = await instance.exec(["-i", inputName, ...args, outputName]);
    if (code !== 0) {
      throw new Error(cleanFfmpegError(lastLog) || `Conversion failed (code ${code}).`);
    }

    const data = await instance.readFile(outputName);
    if (!data || data.byteLength === 0) {
      throw new Error(cleanFfmpegError(lastLog) || "Conversion produced an empty file.");
    }

    onProgress?.(1, "Finishing…");
    // `data` is a Uint8Array; pass it directly so we don't over-read a subarray.
    return new Blob([data], { type: mime });
  } finally {
    instance.off("log", onLog);
    instance.off("progress", onProg);
    // Free the in-memory FS so repeated conversions don't leak.
    await instance.deleteFile(inputName).catch(() => {});
    await instance.deleteFile(outputName).catch(() => {});
  }
}

/** Turn a raw ffmpeg stderr line into something friendlier, when possible. */
function cleanFfmpegError(log) {
  if (!log) return "";
  if (/Invalid data found/i.test(log)) return "This file appears to be corrupt or unsupported.";
  if (/No such file/i.test(log)) return "Could not read the input file.";
  if (/Cannot allocate memory|OOM|out of memory/i.test(log)) {
    return "Ran out of memory — try a smaller file or a lower-resolution output.";
  }
  return log.length > 160 ? `${log.slice(0, 160)}…` : log;
}

/** Optionally warm up the engine ahead of the first conversion. */
export function preloadEngine(onStatus) {
  return ensureLoaded(onStatus).then(
    () => true,
    () => false
  );
}

/** Tear down the worker and free all memory (e.g. on app unmount). */
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
