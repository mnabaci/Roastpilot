import { describe, expect, it } from 'vitest';
import { isLikelyRoaster, roasterRows } from './roaster-rows';

const PORTS = [
  { path: '/dev/cu.debug-console' },
  { path: '/dev/cu.Bluetooth-Incoming-Port' },
  { path: '/dev/cu.ArctisNova7P' },
  { path: '/dev/cu.usbserial-0001', manufacturer: 'Silicon Labs' },
];
const ESP32 = { kind: 'serial', path: '/dev/cu.usbserial-0001' } as const;
const view = { inUse: undefined, saved: null, choosing: true, showAll: false };
const labels = (rows: { label: string }[]) => rows.map((r) => r.label);

describe('isLikelyRoaster', () => {
  it.each([
    [{ path: '/dev/cu.usbserial-0001' }, true],
    [{ path: '/dev/cu.usbmodem14101' }, true],
    [{ path: '/dev/ttyUSB0' }, true],
    [{ path: 'COM3', manufacturer: 'wch.cn' }, true],
    [{ path: '/dev/cu.debug-console' }, false],
    [{ path: '/dev/cu.Bluetooth-Incoming-Port' }, false],
    [{ path: 'COM1' }, false],
  ])('%o: %s', (port, likely) => {
    expect(isLikelyRoaster(port)).toBe(likely);
  });
});

describe('roasterRows', () => {
  it('choosing: likely roasters and the Simulator, the rest hidden', () => {
    const { rows, hidden } = roasterRows(PORTS, view);
    expect(labels(rows)).toEqual(['usbserial-0001', 'Simulator']);
    expect(rows[0]?.detail).toBe('Silicon Labs');
    expect(hidden).toBe(3);
  });

  it('Show all ports lists every port', () => {
    const { rows, hidden } = roasterRows(PORTS, { ...view, showAll: true });
    expect(rows).toHaveLength(5);
    expect(hidden).toBe(0);
  });

  it('the remembered roaster alone until you choose another', () => {
    expect(labels(roasterRows(PORTS, { ...view, saved: ESP32, choosing: false }).rows)).toEqual([
      'usbserial-0001',
    ]);
  });

  it('a remembered port that is not plugged in says so', () => {
    const { rows } = roasterRows([], { ...view, saved: ESP32, choosing: false });
    expect(rows).toEqual([{ target: ESP32, label: 'usbserial-0001', detail: 'Not found' }]);
  });

  it('choosing keeps a remembered port that is unplugged, marked Not found', () => {
    const result = roasterRows([{ path: '/dev/cu.debug-console' }], { ...view, saved: ESP32 });
    expect(labels(result.rows)).toEqual(['usbserial-0001', 'Simulator']);
    expect(result.rows[0]?.detail).toBe('Not found');
    expect(result).toMatchObject({ anyRoaster: false, savedPresent: false, hidden: 1 });
  });

  it('knows when the remembered port is plugged in', () => {
    expect(roasterRows(PORTS, { ...view, saved: ESP32 })).toMatchObject({
      anyRoaster: true,
      savedPresent: true,
    });
  });

  it('only the roaster in use while connected', () => {
    const { rows } = roasterRows(PORTS, { ...view, inUse: { kind: 'simulator' }, saved: ESP32 });
    expect(labels(rows)).toEqual(['Simulator']);
  });
});
