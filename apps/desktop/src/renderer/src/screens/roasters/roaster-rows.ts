import type { ConnectTarget, SerialPortInfo } from '@roastpilot/shared';
import { targetLabel } from '../../app/connection-label';

export interface RoasterRow {
  target: ConnectTarget;
  label: string;
  detail?: string;
}

const SIMULATOR_ROW: RoasterRow = {
  target: { kind: 'simulator' },
  label: 'Simulator',
  detail: 'Practice without a roaster',
};

/** USB serial adapters as macOS, Linux and Windows name them. */
const ADAPTER_PATH = /usbserial|usbmodem|wchusbserial|SLAB_USBtoUART|ttyUSB|ttyACM/i;

/**
 * Could this port be a roaster? A USB adapter's name or a reported maker says yes; system ports
 * (debug-console, Bluetooth, headphones) have neither.
 */
export function isLikelyRoaster(port: SerialPortInfo): boolean {
  return ADAPTER_PATH.test(port.path) || Boolean(port.manufacturer);
}

export const sameTarget = (a: ConnectTarget | null | undefined, b: ConnectTarget): boolean =>
  a?.kind === b.kind && (a.kind === 'simulator' || (b.kind === 'serial' && a.path === b.path));

const portRow = (port: SerialPortInfo): RoasterRow => {
  const target = { kind: 'serial', path: port.path } as const;
  return { target, label: targetLabel(target), detail: port.manufacturer };
};

/** The row for one target: from the port list if it's there, else marked as missing. */
function rowFor(target: ConnectTarget, ports: readonly SerialPortInfo[]): RoasterRow {
  if (target.kind === 'simulator') return SIMULATOR_ROW;
  const port = ports.find((p) => p.path === target.path);
  return port ? portRow(port) : { target, label: targetLabel(target), detail: 'Not found' };
}

/**
 * Which ports a roaster's page lists (docs/spec/ui.md, Roasters screen): only the one in use while
 * connected; the remembered one until you choose another; otherwise likely roasters, with the other
 * ports behind "Show all ports", or every port when none looks like a roaster.
 */
export function roasterRows(
  ports: readonly SerialPortInfo[],
  view: {
    inUse: ConnectTarget | undefined;
    saved: ConnectTarget | null;
    choosing: boolean;
    showAll: boolean;
  },
): {
  rows: RoasterRow[];
  /** Ports left out until "Show all ports". */
  hidden: number;
  /** A likely roaster is plugged in. */
  anyRoaster: boolean;
  /** The remembered roaster can be connected to (its port is there, or it's the Simulator). */
  savedPresent: boolean;
} {
  const anyRoaster = ports.some(isLikelyRoaster);
  const { saved } = view;
  const savedPresent =
    saved?.kind === 'simulator' ||
    (saved?.kind === 'serial' && ports.some((p) => p.path === saved.path));
  const base = { anyRoaster, savedPresent };
  if (view.inUse) return { ...base, rows: [rowFor(view.inUse, ports)], hidden: 0 };
  if (view.saved && !view.choosing)
    return { ...base, rows: [rowFor(view.saved, ports)], hidden: 0 };
  // With no likely roaster plugged in, a filtered list would be empty: show every port at once.
  const listed = view.showAll || !anyRoaster ? ports : ports.filter(isLikelyRoaster);
  const rows = [...listed.map(portRow), SIMULATOR_ROW];
  // The remembered port stays on the list, marked Not found, so the pick is never invisible.
  if (saved && !rows.some((row) => sameTarget(saved, row.target)))
    rows.unshift(rowFor(saved, ports));
  return { ...base, rows, hidden: ports.length - listed.length };
}
