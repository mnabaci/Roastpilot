import { describe, expect, it } from 'vitest';
import { listSerialPorts } from './list-serial-ports';

describe('listSerialPorts', () => {
  it('offers the macOS cu. side of each device', async () => {
    const ports = await listSerialPorts(() =>
      Promise.resolve([{ path: '/dev/tty.usbserial-0001', manufacturer: 'Silicon Labs' }]),
    );
    expect(ports).toEqual([{ path: '/dev/cu.usbserial-0001', manufacturer: 'Silicon Labs' }]);
  });

  it('keeps Windows and Linux names as they are', async () => {
    const ports = await listSerialPorts(() =>
      Promise.resolve([{ path: 'COM3' }, { path: '/dev/ttyUSB0' }]),
    );
    expect(ports).toEqual([{ path: 'COM3' }, { path: '/dev/ttyUSB0' }]);
  });

  it('skips entries without a usable path', async () => {
    const ports = await listSerialPorts(() => Promise.resolve([{ path: undefined }, { path: 42 }]));
    expect(ports).toEqual([]);
  });
});
