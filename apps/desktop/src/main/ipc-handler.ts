import type { IpcCaller } from './ipc-deps';

/** Runs `fn` so that anything it throws, a failed validation included, becomes a rejected promise. */
export function handler<T>(
  fn: (payload: unknown, caller: IpcCaller) => T,
): (payload: unknown, caller: IpcCaller) => Promise<Awaited<T>> {
  // `then` flattens a returned promise, so this resolves to Awaited<T>; tsc can't see that for a generic T.
  return (payload, caller) =>
    Promise.resolve().then(() => fn(payload, caller)) as Promise<Awaited<T>>;
}
