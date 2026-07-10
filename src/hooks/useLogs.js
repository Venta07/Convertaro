import { useEffect, useRef, useState } from "react";
import { log } from "../lib/logger.js";
import { subscribeEngine } from "../lib/ffmpegClient.js";

/**
 * Subscribe to the app log buffer. Updates are coalesced with rAF so a chatty
 * ffmpeg run can't thrash React. Pass `active=false` to pause updates when the
 * diagnostics panel is closed.
 */
export function useLogs(active = true) {
  const [logs, setLogs] = useState(() => log.getAll());
  const frame = useRef(0);

  useEffect(() => {
    if (!active) return undefined;
    setLogs(log.getAll());
    const flush = () => {
      frame.current = 0;
      setLogs(log.getAll());
    };
    const unsubscribe = log.subscribe(() => {
      if (!frame.current) frame.current = requestAnimationFrame(flush);
    });
    return () => {
      unsubscribe();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [active]);

  return logs;
}

/** Subscribe to the ffmpeg engine's load/ready/error state. */
export function useEngineState() {
  const [state, setState] = useState({ status: "idle", mode: null, progress: 0, error: null });
  useEffect(() => subscribeEngine(setState), []);
  return state;
}
