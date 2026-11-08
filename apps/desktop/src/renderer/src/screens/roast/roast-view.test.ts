import { READY_ROAST, type RoastState } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { roastView, type RoastViewInput } from './roast-view';

const ALL_ON = {
  chartProjection: true,
  chartNowLine: true,
  chartTemperatureFocus: true,
  chartPhaseBands: true,
};

const roasting: RoastState = {
  ...READY_ROAST,
  phase: 'roasting',
  preheatAtMs: 0,
  chargedAtMs: 300_000,
  events: [{ kind: 'charge', atMs: 300_000, bt: 180 }],
};

/** A Skywalker roast at 7:00: 175 °C climbing at 9 °C/min, the Light profile expecting 11:16. */
const input = (over: Partial<RoastViewInput> = {}): RoastViewInput => ({
  roast: roasting,
  nowS: 420,
  btC: 175,
  rorCPerMin: 9,
  expectedEndS: 676,
  previous: undefined,
  settings: ALL_ON,
  profileDryEndC: 150,
  expectedFirstCrackC: 192,
  ...over,
});

describe('roastView', () => {
  it('shows everything since Preheat, 0–250 °C and no aids before Start', () => {
    expect(
      roastView(input({ roast: { ...READY_ROAST, phase: 'preheat', preheatAtMs: 0 } })),
    ).toEqual({ timeWindow: undefined, temperatureFloorC: 0, aids: [] });
  });

  it('from Start, focuses on −0:30 to the expected end + 1:00 with every aid', () => {
    const view = roastView(input());
    expect(view.timeWindow).toEqual({ fromS: -30, toS: 736 });
    expect(view.temperatureFloorC).toBe(50);
    expect(view.aids).toEqual([
      {
        kind: 'phase-bands',
        id: 'phase-bands',
        bands: [
          { label: 'Drying', toC: 150 },
          { label: 'Maillard', fromC: 150, toC: 192 },
          { label: 'Development', fromC: 192 },
        ],
      },
      {
        kind: 'projection',
        id: 'projection',
        axis: 'temperature',
        tone: 'heat',
        points: [
          { t: 420, v: 175 },
          { t: 540, v: 193 },
        ],
      },
      { kind: 'now-line', id: 'now', t: 420 },
    ]);
  });

  it('starts the window at 0:00 right after Start, before the first reading', () => {
    expect(roastView(input({ nowS: undefined })).timeWindow).toEqual({ fromS: -30, toS: 736 });
  });

  it('keeps the edge of the window shown before', () => {
    const view = roastView(input({ previous: { fromS: -30, toS: 800 } }));
    expect(view.timeWindow?.toS).toBe(800);
  });

  it('leaves out each aid that is switched off', () => {
    const view = roastView(
      input({
        settings: {
          chartProjection: false,
          chartNowLine: false,
          chartTemperatureFocus: false,
          chartPhaseBands: false,
        },
      }),
    );
    expect(view).toEqual({ timeWindow: { fromS: -30, toS: 736 }, temperatureFloorC: 0, aids: [] });
  });

  it('draws no projection while RoR is unknown or falling', () => {
    const kinds = (over: Partial<RoastViewInput>) =>
      roastView(input(over)).aids.map((aid) => aid.kind);
    expect(kinds({ rorCPerMin: undefined })).toEqual(['phase-bands', 'now-line']);
    expect(kinds({ rorCPerMin: -20 })).toEqual(['phase-bands', 'now-line']);
  });

  it('moves the band edges to the real temperatures at dry end and first crack', () => {
    const cracked: RoastState = {
      ...roasting,
      phase: 'development',
      events: [
        ...roasting.events,
        { kind: 'dry-end', atMs: 600_000, bt: 151 },
        { kind: 'first-crack', atMs: 800_000, bt: 190 },
      ],
    };
    expect(roastView(input({ roast: cracked })).aids[0]).toMatchObject({
      bands: [
        { label: 'Drying', toC: 151 },
        { label: 'Maillard', fromC: 151, toC: 190 },
        { label: 'Development', fromC: 190 },
      ],
    });
  });

  it('runs Maillard to the top when there is no first crack to expect', () => {
    expect(roastView(input({ expectedFirstCrackC: undefined })).aids[0]).toMatchObject({
      bands: [
        { label: 'Drying', toC: 150 },
        { label: 'Maillard', fromC: 150 },
      ],
    });
  });

  it('after Drop keeps the window, widening with cooling, at 0–250 °C without aids', () => {
    const cooling: RoastState = { ...roasting, phase: 'cooling', droppedAtMs: 1_000_000 };
    expect(
      roastView(input({ roast: cooling, nowS: 760, previous: { fromS: -30, toS: 800 } })),
    ).toEqual({ timeWindow: { fromS: -30, toS: 820 }, temperatureFloorC: 0, aids: [] });
  });
});
