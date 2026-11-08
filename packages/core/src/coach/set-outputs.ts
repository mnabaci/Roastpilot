import type { Reading } from '@roastpilot/shared';

/** The roaster reports a new setting within two polls (docs/spec/manual-mode.md, sliders). */
export const SET_PENDING_MS = 2_000;

/** What is set on heater and fan: your value for a moment after you set it, then the roaster's. */
export class SetOutputs {
  readonly #requested = new Map<string, { value: number; atMs: number }>();

  requested(channel: string, value: number, atMs: number): void {
    this.#requested.set(channel, { value, atMs });
  }

  /** You set this output a moment ago, and the roaster may not have said so yet. */
  pending(channel: string, nowMs: number): boolean {
    const requested = this.#requested.get(channel);
    return requested !== undefined && nowMs - requested.atMs < SET_PENDING_MS;
  }

  value(channel: string, reading: Reading): number | undefined {
    const requested = this.#requested.get(channel);
    if (requested && this.pending(channel, reading.atMs)) return requested.value;
    return reading.values[channel];
  }
}
