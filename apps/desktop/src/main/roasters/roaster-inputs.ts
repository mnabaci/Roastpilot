import type { DriverError, RoasterDriver } from '@roastpilot/core';
import { err, type ReadInputsError, type Result, type Tc4Inputs } from '@roastpilot/shared';

/** A driver that can read every input at once (the generic TC4's). */
interface InputReader {
  readInputs(): Promise<Result<(number | null)[], DriverError>>;
}

const isInputReader = (driver: RoasterDriver): driver is RoasterDriver & InputReader =>
  typeof (driver as Partial<InputReader>).readInputs === 'function';

/**
 * TC1–TC4 of the connected board, to pick a probe by its reading (docs/spec/roasters.md, Generic
 * TC4). Only while connected and not roasting: switching inputs mid-roast would cost readings.
 */
export class RoasterInputs {
  #reader: InputReader | undefined;

  /** The driver just built for Connect; one that can't read its inputs clears the last one. */
  attach(driver: RoasterDriver): void {
    this.#reader = isInputReader(driver) ? driver : undefined;
  }

  async read(state: {
    connected: boolean;
    roasting: boolean;
  }): Promise<Result<Tc4Inputs, ReadInputsError>> {
    if (!state.connected || !this.#reader) return err({ kind: 'unavailable' });
    if (state.roasting) return err({ kind: 'roasting' });
    return this.#reader.readInputs();
  }
}
