import type { ConnectTarget } from '@roastpilot/shared';

/**
 * A short name for what the app is connected to: "Simulator", or the port without its folder and
 * macOS prefix ("/dev/cu.usbserial-0001" → "usbserial-0001", "COM3" stays "COM3").
 */
export function targetLabel(target: ConnectTarget): string {
  if (target.kind === 'simulator') return 'Simulator';
  const name = target.path.split(/[\\/]/).pop() ?? target.path;
  return name.replace(/^(cu|tty)\./, '') || target.path;
}
