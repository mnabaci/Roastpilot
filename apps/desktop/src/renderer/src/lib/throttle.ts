/**
 * Calls `send` at once, then at most every `ms`, always ending with the latest value, so a
 * slider drag sends a few commands and never drops the one you let go on.
 */
export function throttle<T>(
  send: (value: T) => void,
  ms: number,
): { push: (value: T) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queued: { value: T } | undefined;
  const flush = () => {
    timer = undefined;
    if (!queued) return;
    const { value } = queued;
    queued = undefined;
    send(value);
    timer = setTimeout(flush, ms);
  };
  return {
    push: (value) => {
      queued = { value };
      if (!timer) flush();
    },
    cancel: () => {
      clearTimeout(timer);
      timer = undefined;
      queued = undefined;
    },
  };
}
