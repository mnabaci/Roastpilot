import type { ConnectTarget, Roaster } from '@roastpilot/shared';

/**
 * A short name for what the app is connected to: "Simulator", or the port without its folder and
 * macOS prefix ("/dev/cu.usbserial-0001" → "usbserial-0001", "COM3" stays "COM3").
 */
export function targetLabel(target: ConnectTarget): string {
  if (target.kind === 'simulator') return 'Simulator';
  const name = target.path.split(/[\\/]/).pop() ?? target.path;
  return name.replace(/^(cu|tty)\./, '') || target.path;
}

/**
 * The top bar's name for the roaster in use (docs/spec/ui.md, Top bar): the active record's name,
 * as Connect always uses the active roaster; its port only when no record of that kind is active.
 */
export function connectedName(target: ConnectTarget, active: Roaster | undefined): string {
  const matches =
    active !== undefined && (active.model === 'simulator') === (target.kind === 'simulator');
  return matches ? active.name : targetLabel(target);
}
