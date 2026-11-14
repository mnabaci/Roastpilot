import { err } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { COMMAND_GAP_MS } from './command-queue';
import { connected, setup, sketch } from './sky-command-fixture';

describe('Tc4Driver with the SkyCommand dialect: outputs and safe stop', () => {
  describe('setOutput', () => {
    it.each([
      ['heater', 43, 'OT1;45'],
      ['fan', 150, 'OT2;100'],
      ['cooling', 100, 'COOL;100'],
      ['filter', 2, 'FILTER;2'],
      ['drum', 1, 'DRUM;1'],
      ['drum', 0, 'DRUM;0'],
    ])('sends %s %d as %s', async (channel, value, line) => {
      const { transport, driver, run } = await connected();
      expect((await run(driver.setOutput(channel, value))).ok).toBe(true);
      expect(transport.sentLines()).toEqual([line]);
    });

    it('keeps the filter to levels 0–4 and cooling to 0 or 100, the only values the roaster takes', async () => {
      const { transport, driver, run } = await connected();
      await run(driver.setOutput('filter', 100));
      await run(driver.setOutput('filter', 1));
      await run(driver.setOutput('cooling', 60));
      await run(driver.setOutput('cooling', 30));
      expect(transport.sent.map((s) => s.line)).toEqual([
        'FILTER;4',
        'FILTER;1',
        'COOL;100',
        'COOL;0',
      ]);
    });

    it('rejects unknown channels and the sensor without sending anything', async () => {
      const { transport, driver, run } = await connected();
      expect(await run(driver.setOutput('boost', 50))).toEqual(
        err({ kind: 'unknown-channel', channel: 'boost' }),
      );
      expect(await run(driver.setOutput('bt', 50))).toEqual(
        err({ kind: 'unknown-channel', channel: 'bt' }),
      );
      expect(transport.sent).toEqual([]);
    });

    it('refuses before connect', async () => {
      const { transport, driver, run } = setup();
      expect(await run(driver.setOutput('heater', 50))).toEqual(err({ kind: 'disconnected' }));
      expect(transport.sent).toEqual([]);
    });
  });

  describe('safeStop', () => {
    it('sends heater 0, fan 100, cooling 100 in order, spaced by the gap', async () => {
      const { transport, driver, run } = await connected();
      await run(driver.safeStop());
      expect(transport.sentLines()).toEqual(['OT1;0', 'OT2;100', 'COOL;100']);
      const gaps = transport.sent.slice(1).map((s, i) => s.atMs - (transport.sent[i]?.atMs ?? 0));
      expect(gaps.every((gap) => gap >= COMMAND_GAP_MS)).toBe(true);
    });

    it('logs when the safe stop needed the ESTOP fallback', async () => {
      const { transport, driver, run, entries } = await connected();
      transport.failWrite = (line) => line === 'OT1;0';
      await run(driver.safeStop());
      expect(entries.map((e) => e.event)).toEqual(['driver.safe-stop-incomplete']);
    });

    it('falls back to ESTOP when a safe-stop command fails', async () => {
      const { transport, driver, run } = await connected();
      transport.failWrite = (line) => line === 'OT2;100';
      await run(driver.safeStop());
      expect(transport.sentLines()).toEqual(['OT1;0', 'COOL;100', 'ESTOP']);
    });

    it('takes the outputs ESTOP leaves as sent, so the next reading is no surprise', async () => {
      const board = sketch();
      const { transport, driver, run, entries } = await connected((line) =>
        line === 'READ' ? '0.00,42.39,42.39,0,100,0' : board(line),
      );
      await run(driver.setOutput('heater', 60));
      await run(driver.setOutput('fan', 40));
      transport.failWrite = (line) => line === 'OT2;100';
      await run(driver.safeStop());
      const reading = await run(driver.read());
      expect(reading.ok && reading.value.values).toMatchObject({ heater: 0, fan: 100 });
      expect(entries.map((e) => e.event)).not.toContain('driver.output-changed-by-board');
    });

    it('still tries when the driver thinks it is disconnected', async () => {
      const { transport, driver, run } = await connected();
      // A failed handshake leaves the driver disconnected but the port may still work.
      transport.reply = sketch('2');
      await run(driver.connect());
      await transport.open();
      transport.sent.length = 0;
      await run(driver.safeStop());
      expect(transport.sentLines()).toEqual(['OT1;0', 'OT2;100', 'COOL;100']);
    });

    it('resolves without throwing when the cable is pulled', async () => {
      const { transport, driver, run } = await connected();
      transport.drop();
      await expect(run(driver.safeStop())).resolves.toBeUndefined();
    });

    it('logs an error when the ESTOP fallback fails too', async () => {
      const { transport, driver, run, entries } = await connected();
      transport.drop();
      await run(driver.safeStop());
      expect(entries.map((e) => [e.level, e.event])).toEqual([
        ['warn', 'driver.safe-stop-incomplete'],
        ['error', 'driver.fallback-stop-failed'],
      ]);
    });

    it('waits behind a pending read instead of merging with it', async () => {
      const { transport, driver, run } = await connected();
      const reading = driver.read();
      const stop = driver.safeStop();
      await run(Promise.all([reading, stop]));
      expect(transport.sentLines()).toEqual(['READ', 'OT1;0', 'OT2;100', 'COOL;100']);
    });
  });
});
