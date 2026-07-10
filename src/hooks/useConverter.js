import { useCallback, useEffect, useRef, useState } from "react";
import { detectFile } from "../lib/detect.js";
import { getDefaultOutput, getOutputOptions } from "../lib/formats.js";
import { convertFile } from "../lib/convert.js";
import { cancelActiveJob } from "../lib/ffmpegClient.js";
import { uid } from "../lib/utils.js";
import { log } from "../lib/logger.js";

/** Files above this size get a soft "this may be slow / OOM" warning. */
const LARGE_FILE_MB = 300;

/**
 * @typedef {Object} QueueItem
 * @property {string} id
 * @property {File} file
 * @property {string} name
 * @property {number} size
 * @property {'image'|'audio'|'video'|'unknown'} category
 * @property {string} inputFormat
 * @property {string} outputFormat
 * @property {{value:string,label:string,engine:string}[]} outputOptions
 * @property {'idle'|'converting'|'done'|'error'} status
 * @property {number} progress            0..1
 * @property {string} statusText
 * @property {boolean} sizeWarning
 * @property {string|null} previewUrl     object URL for image thumbnails
 * @property {{url:string,name:string,size:number,blob:Blob}|null} result
 * @property {string|null} error
 */

function createItem(file) {
  const { category, format, mime } = detectFile(file);
  const outputOptions = getOutputOptions(category, format);
  const previewUrl = category === "image" ? URL.createObjectURL(file) : null;

  log.info("queue", `added ${file.name}`, {
    detected: `${category}/${format || "?"}`,
    mime: mime || "(none)",
    sizeMB: +(file.size / 1048576).toFixed(2),
    outputs: outputOptions.map((o) => o.value),
  });
  if (outputOptions.length === 0) {
    log.warn("queue", `no client-side conversion available for ${file.name} (${category}/${format})`);
  }

  return {
    id: uid(),
    file,
    name: file.name,
    size: file.size,
    category,
    inputFormat: format,
    outputFormat: getDefaultOutput(category, format),
    outputOptions,
    status: "idle",
    progress: 0,
    statusText: "",
    sizeWarning: file.size > LARGE_FILE_MB * 1048576,
    previewUrl,
    result: null,
    error: null,
  };
}

function revokeItem(item) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  if (item.result?.url) URL.revokeObjectURL(item.result.url);
}

export function useConverter() {
  const [files, setFiles] = useState(/** @type {QueueItem[]} */ ([]));

  // Ref mirror so async loops (convertAll) always read the latest queue.
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Track liveness so a conversion that resolves after unmount can revoke the
  // object URL it just created instead of leaking it.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      filesRef.current.forEach(revokeItem);
    };
  }, []);

  const patch = useCallback((id, updater) => {
    setFiles((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return typeof updater === "function" ? updater(it) : { ...it, ...updater };
      })
    );
  }, []);

  const addFiles = useCallback((incoming) => {
    const items = Array.from(incoming).map(createItem);
    setFiles((prev) => [...prev, ...items]);
  }, []);

  const removeFile = useCallback((id) => {
    setFiles((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) revokeItem(target);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setFiles((prev) => {
      prev.forEach(revokeItem);
      return [];
    });
  }, []);

  const setOutputFormat = useCallback(
    (id, outputFormat) => {
      patch(id, (it) => {
        // Changing the target resets any prior result so the user can reconvert.
        if (it.result?.url) URL.revokeObjectURL(it.result.url);
        return {
          ...it,
          outputFormat,
          status: "idle",
          progress: 0,
          statusText: "",
          result: null,
          error: null,
        };
      });
    },
    [patch]
  );

  const convertOne = useCallback(
    async (id) => {
      const item = filesRef.current.find((it) => it.id === id);
      if (!item || item.status === "converting" || item.outputOptions.length === 0) return;

      if (item.result?.url) URL.revokeObjectURL(item.result.url);
      patch(id, { status: "converting", progress: 0, statusText: "Starting…", result: null, error: null });

      try {
        const onProgress = (progress, statusText) =>
          patch(id, (it) =>
            it.status === "converting"
              ? { ...it, progress: progress ?? it.progress, statusText: statusText ?? it.statusText }
              : it
          );

        const { blob, name } = await convertFile(item, { onProgress });
        const url = URL.createObjectURL(blob);
        if (!mountedRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
        patch(id, {
          status: "done",
          progress: 1,
          statusText: "Done",
          result: { url, name, size: blob.size, blob },
          error: null,
        });
      } catch (err) {
        if (err?.name === "CanceledError") {
          patch(id, { status: "idle", progress: 0, statusText: "", error: null });
          return;
        }
        log.error("queue", `failed: ${item.name}`, err);
        patch(id, {
          status: "error",
          progress: 0,
          statusText: "",
          error: err?.message || "Conversion failed.",
        });
      }
    },
    [patch]
  );

  // Cancel the in-flight conversion (ffmpeg jobs only; canvas is instant).
  const cancel = useCallback((id) => {
    log.warn("queue", `cancel requested for ${id}`);
    cancelActiveJob();
  }, []);

  // Convert every pending item. ffmpeg runs one job at a time, so we go sequentially.
  const convertAll = useCallback(async () => {
    const pending = filesRef.current.filter(
      (it) => it.status !== "done" && it.status !== "converting" && it.outputOptions.length > 0
    );
    log.info("queue", `convert all — ${pending.length} file(s)`);
    for (const it of pending) {
      // eslint-disable-next-line no-await-in-loop
      await convertOne(it.id);
    }
  }, [convertOne]);

  const stats = {
    total: files.length,
    done: files.filter((f) => f.status === "done").length,
    pending: files.filter(
      (f) => (f.status === "idle" || f.status === "error") && f.outputOptions.length > 0
    ).length,
    converting: files.some((f) => f.status === "converting"),
    convertible: files.filter((f) => f.outputOptions.length > 0).length,
  };

  return {
    files,
    stats,
    addFiles,
    removeFile,
    clearAll,
    setOutputFormat,
    convertOne,
    convertAll,
    cancel,
  };
}
