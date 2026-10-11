import { listStrategies } from "@/api/endpoints";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export type WaitForStrategiesOpts = {
  /** When set, keep polling until this name appears in /strategies. */
  expectName?: string | null;
  /** Total wait budget (compile + restart). Default 90s. */
  timeoutMs?: number;
  /** Delay between probes. Default 2s. */
  intervalMs?: number;
  /** Skip the first probe — engine is usually still compiling. Default 3s. */
  initialDelayMs?: number;
  signal?: AbortSignal;
};

/**
 * Probe AlgoCraft until /strategies responds (and optionally includes expectName).
 * Failures while the engine is down are swallowed — callers should not surface them.
 * Returns the list on success, or null on timeout / abort.
 */
export async function waitForStrategies(
  opts: WaitForStrategiesOpts = {},
): Promise<string[] | null> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const initialDelayMs = opts.initialDelayMs ?? 3_000;
  const expect = opts.expectName?.trim() || null;
  const signal = opts.signal;
  const started = Date.now();

  try {
    if (initialDelayMs > 0) {
      await sleep(initialDelayMs, signal);
    }

    while (Date.now() - started < timeoutMs) {
      if (signal?.aborted) return null;
      try {
        const list = await listStrategies();
        if (!expect || list.includes(expect)) {
          return list;
        }
        // Engine is up but the new strategy is not registered yet.
      } catch {
        // Restart / compile window — ignore and retry.
      }
      await sleep(intervalMs, signal);
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return null;
    }
    throw e;
  }

  return null;
}
