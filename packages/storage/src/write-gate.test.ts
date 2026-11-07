import { describe, expect, it } from 'vitest';
import { WriteGate } from './write-gate';

/** A promise and the function that settles it. */
function deferred() {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('WriteGate', () => {
  it('runs a statement at once when nothing holds the gate', async () => {
    const gate = new WriteGate();
    let ran = false;
    const done = gate.enter(() => {
      ran = true;
    });
    expect(ran).toBe(true);
    await done;
  });

  it('makes statements and other holders wait until the holder settles, in order', async () => {
    const gate = new WriteGate();
    const order: string[] = [];
    const first = deferred();
    const holding = gate.hold(async () => {
      order.push('hold 1 starts');
      await first.promise;
      order.push('hold 1 ends');
    });
    const statement = gate.enter(() => order.push('statement'));
    const second = gate.hold(() => {
      order.push('hold 2');
      return Promise.resolve();
    });
    await Promise.resolve();
    expect(order).toEqual(['hold 1 starts']);
    first.resolve();
    await Promise.all([holding, statement, second]);
    expect(order).toEqual(['hold 1 starts', 'hold 1 ends', 'statement', 'hold 2']);
  });

  it('lets go of the gate when the holder throws', async () => {
    const gate = new WriteGate();
    await expect(gate.hold(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await gate.enter(() => 'free')).toBe('free');
  });
});
