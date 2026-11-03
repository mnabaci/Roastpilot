import type { MockPortBinding } from '@serialport/binding-mock';
import { SerialPortMock } from 'serialport';
import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { SerialTransport } from './serial-transport';

const PATH = '/dev/cu.usbserial-TEST';

function setup() {
  SerialPortMock.binding.createPort(PATH, { echo: false, record: true });
  let port: SerialPortMock | undefined;
  const transport = new SerialTransport({
    path: PATH,
    createPort: (path, baudRate) => {
      port = new SerialPortMock({ path, baudRate, autoOpen: false });
      return port;
    },
  });
  /** The simulated board on the other end of the cable. */
  const board = (): MockPortBinding => {
    // `port.port` is typed through @serialport/bindings-interface, which pnpm keeps out of reach.
    const binding = port?.port as MockPortBinding | undefined;
    if (!binding) throw new Error('port not open yet');
    return binding;
  };
  return { transport, board };
}

function nextLine(transport: SerialTransport): Promise<string> {
  return new Promise((resolve) => {
    transport.onLine(resolve);
  });
}

afterEach(() => {
  SerialPortMock.binding.reset();
});

describe('SerialTransport', () => {
  it('writes newline-terminated lines', async () => {
    const { transport, board } = setup();
    expect(await transport.open()).toEqual({ ok: true, value: undefined });
    expect((await transport.write('UNITS;C')).ok).toBe(true);
    expect(board().recording.toString()).toBe('UNITS;C\n');
    await transport.close();
  });

  it('emits received lines without CR or LF', async () => {
    const { transport, board } = setup();
    await transport.open();
    const line = nextLine(transport);
    board().emitData('0.00,42.39,42.39,30,0,0\r\n');
    expect(await line).toBe('0.00,42.39,42.39,30,0,0');
    await transport.close();
  });

  it('fails to open a port that does not exist', async () => {
    const transport = new SerialTransport({
      path: '/dev/missing',
      createPort: (path, baudRate) => new SerialPortMock({ path, baudRate, autoOpen: false }),
    });
    expect(await transport.open()).toMatchObject({ ok: false, error: { kind: 'disconnected' } });
  });

  it('refuses writes when closed and reports the close', async () => {
    const { transport } = setup();
    await transport.open();
    let closed = false;
    transport.onClose(() => {
      closed = true;
    });
    await transport.close();
    expect(closed).toBe(true);
    expect(await transport.write('READ')).toMatchObject({
      ok: false,
      error: { kind: 'disconnected' },
    });
  });

  it('can open again after closing', async () => {
    const { transport } = setup();
    await transport.open();
    await transport.close();
    expect((await transport.open()).ok).toBe(true);
    await transport.close();
  });
});

describe('SerialTransport logging', () => {
  function loggedSetup() {
    const entries: LogEntry[] = [];
    SerialPortMock.binding.createPort(PATH, { echo: false, record: true });
    const transport = new SerialTransport({
      path: PATH,
      createPort: (path, baudRate) => new SerialPortMock({ path, baudRate, autoOpen: false }),
      logger: createLogger({ write: (e) => entries.push(e) }, 'serial'),
    });
    return { transport, events: () => entries.map((e) => e.event) };
  }

  it('logs a port that fails to open', async () => {
    const entries: LogEntry[] = [];
    const transport = new SerialTransport({
      path: '/dev/missing',
      createPort: (path, baudRate) => new SerialPortMock({ path, baudRate, autoOpen: false }),
      logger: createLogger({ write: (e) => entries.push(e) }, 'serial'),
    });
    await transport.open();
    expect(entries.map((e) => e.event)).toEqual(['serial.open-failed']);
  });

  it('does not log a close it was asked for', async () => {
    const { transport, events } = loggedSetup();
    await transport.open();
    await transport.close();
    expect(events()).toEqual([]);
  });
});
