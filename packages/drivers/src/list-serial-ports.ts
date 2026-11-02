import type { SerialPortInfo } from '@roastpilot/shared';
import { SerialPort } from 'serialport';

/** Raw port entry. `serialport` types SerialPort.list() as any[] (see scripts/serial-console.ts). */
interface RawPort {
  path: unknown;
  manufacturer?: unknown;
}

/**
 * Ports to offer in the picker. macOS lists each device twice-named; the `cu.` side is the one to
 * open for outgoing connections, so `/dev/tty.x` is reported as `/dev/cu.x`.
 */
export async function listSerialPorts(
  list: () => Promise<RawPort[]> = () => SerialPort.list() as Promise<RawPort[]>,
): Promise<SerialPortInfo[]> {
  const ports = await list();
  return ports.flatMap((port) => {
    if (typeof port.path !== 'string') return [];
    const path = port.path.replace(/^\/dev\/tty\./, '/dev/cu.');
    return [
      typeof port.manufacturer === 'string' ? { path, manufacturer: port.manufacturer } : { path },
    ];
  });
}
