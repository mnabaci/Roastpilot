import type { RoasterDriver } from '@roastpilot/core';
import { SimulatedDriver } from '@roastpilot/drivers';
import type { RoastPhase, RoastState } from '@roastpilot/shared';

const BEANS_IN: readonly RoastPhase[] = ['roasting', 'development'];

/**
 * On the simulator, Start puts beans in the drum and Drop (or End) takes them out, so a roast in
 * the app dips and turns like a real one (docs/spec/hardware.md, Simulator). Real drivers pass
 * through untouched.
 */
export class SimulatorBeans {
  #simulator: SimulatedDriver | undefined;
  #inDrum = false;

  /** Every driver the app builds goes through here; remembers it if it is the simulator. */
  attach(driver: RoasterDriver): RoasterDriver {
    this.#simulator = driver instanceof SimulatedDriver ? driver : undefined;
    this.#inDrum = false;
    return driver;
  }

  onRoast(state: RoastState): void {
    const inDrum = BEANS_IN.includes(state.phase);
    if (!this.#simulator || inDrum === this.#inDrum) return;
    this.#inDrum = inDrum;
    if (inDrum) this.#simulator.chargeBeans();
    else this.#simulator.dumpBeans();
  }
}
