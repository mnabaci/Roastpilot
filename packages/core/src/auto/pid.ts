import type { PidGains } from '@roastpilot/shared';

export interface PidLimits {
  min: number;
  max: number;
}

/**
 * A PID on a caller-supplied error. Time comes in as `dtS`, so it stays pure. The integral stops
 * while the output is at a limit and the error would push it further, and it never holds more than
 * the limits allow, so narrower limits take effect at once (anti-windup).
 */
export class Pid {
  readonly #gains: PidGains;
  #integral = 0;
  #lastError: number | undefined;
  #lastOutput = 0;

  constructor(gains: PidGains) {
    this.#gains = gains;
  }

  /** The output for this error. A bad error or time step changes nothing and repeats the last. */
  update(error: number, dtS: number, limits: PidLimits): number {
    if (!Number.isFinite(error) || !Number.isFinite(dtS) || dtS <= 0) {
      return clamp(this.#lastOutput, limits);
    }
    const { kp, ki, kd } = this.#gains;
    const derivative = this.#lastError === undefined ? 0 : (error - this.#lastError) / dtS;
    this.#lastError = error;

    this.#integral = clamp(this.#integral, limits);
    const nextIntegral = clamp(this.#integral + ki * error * dtS, limits);
    const unclamped = kp * error + nextIntegral + kd * derivative;
    const output = clamp(unclamped, limits);
    const pushingFurther =
      (unclamped > limits.max && error > 0) || (unclamped < limits.min && error < 0);
    if (!pushingFurther) this.#integral = nextIntegral;
    this.#lastOutput = output;
    return output;
  }
}

function clamp(value: number, { min, max }: PidLimits): number {
  return Math.min(max, Math.max(min, value));
}
