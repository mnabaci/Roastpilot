import type { RoastDetail } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { eventRows } from './event-rows';

/** A roast saved at 1 s: BT climbing 0.2 °C/s from charge, heater 80 then 40 after 60 s. */
const detail: RoastDetail = {
  id: 7,
  mode: 'manual',
  profile: null,
  roasterId: null,
  beanId: null,
  ghostRoastId: null,
  batchG: null,
  roastedG: null,
  rating: null,
  isFavourite: false,
  notes: null,
  profileId: null,
  profileName: null,
  imported: false,
  startedAt: '2026-11-04T17:37:20.466Z',
  endedAt: '2026-11-04T17:52:23.388Z',
  fcTimeS: 90,
  fcTemp: null,
  dropTimeS: 120,
  dropTemp: 124,
  samples: Array.from({ length: 141 }, (_, i) => ({
    tS: i - 10,
    values: { bt: 100 + (i - 10) * 0.2, heater: i - 10 < 60 ? 80 : 40, fan: 30 },
  })),
  events: [
    { kind: 'first-crack', tS: 90, bt: 118 },
    { kind: 'charge', tS: 0, bt: 100 },
    { kind: 'drop', tS: 120, bt: 124 },
    { kind: 'cool-end', tS: 130, bt: null },
  ],
};

describe('eventRows', () => {
  it('lists the events in time order with the values at each moment', () => {
    expect(eventRows(detail)).toEqual([
      {
        event: 'Charge',
        time: '0:00',
        bt: '100.0 °C',
        ror: undefined,
        heater: '80 %',
        fan: '30 %',
      },
      {
        event: 'First crack',
        time: '1:30',
        bt: '118.0 °C',
        ror: '12.0',
        heater: '40 %',
        fan: '30 %',
      },
      { event: 'Drop', time: '2:00', bt: '124.0 °C', ror: '12.0', heater: '40 %', fan: '30 %' },
      // No RoR after drop; BT from the samples when the event has none.
      {
        event: 'Cool end',
        time: '2:10',
        bt: '126.0 °C',
        ror: undefined,
        heater: '40 %',
        fan: '30 %',
      },
    ]);
  });

  it('turning point gets its own row; an event with no sample yet has dashes', () => {
    const rows = eventRows({
      ...detail,
      samples: [],
      events: [{ kind: 'turning-point', tS: 64, bt: 92.2 }],
    });
    expect(rows).toEqual([
      {
        event: 'Turning point',
        time: '1:04',
        bt: '92.2 °C',
        ror: undefined,
        heater: undefined,
        fan: undefined,
      },
    ]);
  });

  it('names what Auto did from the saved detail', () => {
    const auto: RoastDetail = {
      ...detail,
      events: [
        { kind: 'phase', tS: 60, bt: 110, detail: 'Heat on' },
        { kind: 'dry-end', tS: 70, bt: 150 },
        { kind: 'override', tS: 80, bt: 155, detail: 'fan 50' },
      ],
    };
    expect(eventRows(auto).map((row) => row.event)).toEqual([
      'Step · Heat on',
      'Dry end',
      'Override · fan 50',
    ]);
  });
});
