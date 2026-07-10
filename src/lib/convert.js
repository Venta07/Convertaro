import { convertImage } from "./imageConverter.js";
import { getFfmpegArgs, getFormatMeta, getOutputOptions } from "./formats.js";
import { ffmpegConvert } from "./ffmpegClient.js";
import { baseName } from "./utils.js";
import { log } from "./logger.js";

/**
 * Convert a queued file to its selected output format, routing to the Canvas
 * engine (images) or the ffmpeg WASM engine (audio/video/gif/tiff).
 *
 * @param {import('../hooks/useConverter.js').QueueItem} item
 * @param {object} [opts]
 * @param {(progress:number, statusText?:string)=>void} [opts.onProgress]
 * @returns {Promise<{blob: Blob, name: string}>}
 */
export async function convertFile(item, { onProgress } = {}) {
  const { file, category, inputFormat, outputFormat } = item;

  const meta = getFormatMeta(outputFormat);
  if (!outputFormat || !meta) {
    throw new Error("Please pick an output format.");
  }

  // Resolve the engine from the compatibility matrix (don't trust stale UI state).
  const options = item.outputOptions?.length
    ? item.outputOptions
    : getOutputOptions(category, inputFormat);
  const option = options.find((o) => o.value === outputFormat);
  if (!option) {
    throw new Error(`Can't convert ${inputFormat || "this file"} to ${outputFormat}.`);
  }

  const outName = `${baseName(file.name) || "converted"}.${meta.ext}`;

  log.info(
    "convert",
    `${inputFormat || "?"} → ${outputFormat} via ${option.engine}`,
    { file: file.name, sizeMB: +(file.size / 1048576).toFixed(2), category }
  );

  if (option.engine === "canvas") {
    const blob = await convertImage(file, outputFormat, {
      onProgress: (p) => onProgress?.(p, "Converting image…"),
    });
    return { blob, name: outName };
  }

  // ffmpeg engine
  const args = getFfmpegArgs(category, inputFormat, outputFormat);
  const inExt = (inputFormat || "bin").toLowerCase();
  const blob = await ffmpegConvert({
    file,
    inputName: `in-${item.id}.${inExt}`,
    outputName: `out-${item.id}.${meta.ext}`,
    args,
    mime: meta.mime,
    onProgress,
  });
  return { blob, name: outName };
}
