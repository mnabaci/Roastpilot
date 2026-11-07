import type { Reading, RoastAction, RoastEvent, RoastState } from '@roastpilot/shared';
import type { Logger } from '../logging/logger';
import type { BeanCooling } from './bean-cooling';
import type { ManualRoastDeps } from './manual-roast-deps';
import { chargeFor } from './roast-detections';
import { ALL_OFF, roastOn, type Outputs } from './roast-outputs';
import type { RoastOptions } from './roast-rules';
import type { RoasterCooling } from './roaster-cooling';
import { cleared, cracked, ended, preheated, preheatEnded, started } from './roast-transitions';

/** What the steps need from ManualRoast, which owns the state. */
export interface RoastStepsHost {
  deps: ManualRoastDeps;
  logger: Logger;
  options: () => RoastOptions;
  readings: () => readonly Reading[];
  cooling: RoasterCooling;
  beans: BeanCooling;
  state: () => RoastState;
  set: (state: RoastState) => void;
  send: (outputs: Outputs) => Promise<void>;
  event: (kind: RoastEvent['kind'], atMs: number) => RoastEvent;
}

export type RoastSteps = Readonly<Record<RoastAction, (nowMs: number) => Promise<void>>>;

/** A roast begins: drum cooling ends, and its fan and bean cooler go back to 0 (you set them). */
function endCoolingForRoast(cooling: RoasterCooling, reason: 'preheat' | 'roast-started'): Outputs {
  return cooling.stopWithoutOutputs(reason)
    ? [
        ['fan', 0],
        ['cooling', 0],
      ]
    : [];
}

/** One step per action of the manual flow; ALLOWED_FROM has already checked the state. */
export function roastSteps(host: RoastStepsHost): RoastSteps {
  const { deps, logger, options, cooling, beans } = host;
  return {
    preheat: async (nowMs) => {
      const fanOff = endCoolingForRoast(cooling, 'preheat');
      deps.onNewRoast();
      host.set(preheated(nowMs));
      await host.send([...fanOff, ...roastOn(options().drumOn)]);
    },
    start: async (nowMs) => {
      const fanOff = endCoolingForRoast(cooling, 'roast-started');
      const charge = chargeFor(host.state(), host.readings(), nowMs, {
        findPoint: options().findChargePoint,
        latestBt: deps.latestBt(),
      });
      if (charge.earlierMs > 0) logger.info('roast.charge-found', { earlierMs: charge.earlierMs });
      host.set(started(host.state(), charge, nowMs));
      deps.onRoastStarted(charge.atMs);
      await host.send([...fanOff, ...roastOn(options().drumOn)]);
    },
    'first-crack': (nowMs) => {
      host.set(cracked(host.state(), host.event('first-crack', nowMs)));
      return Promise.resolve();
    },
    // Forgets the last roast's readings and events; sends nothing. Drum cooling keeps running.
    clear: () => {
      deps.onNewRoast();
      host.set(cleared(host.state()));
      return Promise.resolve();
    },
    drop: async (nowMs) => {
      await beans.start(host.event('drop', nowMs));
      deps.onRoastEnded();
    },
    // In Preheat nothing has roasted: back to Ready, the preheat stays on the chart until Clear. In
    // Cooling it finishes bean cooling now. In between it ends the roast where it is.
    end: async (nowMs) => {
      beans.cancel();
      const state = host.state();
      if (state.phase === 'cooling') {
        await beans.finishNow();
        return;
      }
      if (state.phase === 'preheat') host.set(preheatEnded(state));
      else {
        host.set(ended(state, host.event('end', nowMs)));
        deps.onRoastEnded();
      }
      await host.send(ALL_OFF);
    },
    'extend-cooling': (nowMs) => {
      beans.extend(nowMs);
      return Promise.resolve();
    },
    'cool-roaster': async (nowMs) => {
      await cooling.start(nowMs, options().roasterCoolToC, 'asked');
    },
    'stop-cooling-roaster': async () => {
      await cooling.end('stopped');
    },
  };
}
