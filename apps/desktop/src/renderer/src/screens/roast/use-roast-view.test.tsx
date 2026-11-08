import { READY_ROAST, type RoastState } from '@roastpilot/shared';
import type { LineLayer } from '@roastpilot/ui';
import { act, screen } from '@testing-library/react';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { describe, expect, it } from 'vitest';
import { ACCEPTED_SETTINGS, renderApp } from '../../test/render-app';
import { useRoastView } from './use-roast-view';

interface Moment {
  roast: RoastState;
  /** The live line's coolest point and its last time. */
  lowestC: number;
  nowS: number;
  ghost: { dropS?: number; tpC?: number };
}

const roasting: RoastState = {
  ...READY_ROAST,
  phase: 'roasting',
  chargedAtMs: 1000,
  events: [{ kind: 'charge', atMs: 1000, bt: 180 }],
};

const live = ({ lowestC, nowS }: Moment): LineLayer => ({
  id: 'bt',
  label: 'Temperature',
  axis: 'temperature',
  tone: 'heat',
  width: 3.5,
  points: [
    { t: 0, v: 180 },
    { t: 80, v: lowestC },
    { t: nowS, v: 150 },
  ],
});

let setMoment: Dispatch<SetStateAction<Moment>> = () => undefined;

/** Shows the view's window edge and floor, and lets the test move the roast on. */
function Probe({ first }: { first: Moment }) {
  const [moment, set] = useState(first);
  useEffect(() => {
    setMoment = set;
  }, []);
  const view = useRoastView({
    roast: moment.roast,
    lines: [live(moment)],
    rorCPerMin: 10,
    ghost: moment.ghost,
  });
  return <p>{`edge ${String(view.timeWindow?.toS)} floor ${String(view.temperatureFloorC)}`}</p>;
}

const start: Moment = { roast: roasting, lowestC: 90, nowS: 300, ghost: { dropS: 660, tpC: 88 } };
// A manual roast without the coach: the ghost alone sets the expected end and turning point.
const settings = { ...ACCEPTED_SETTINGS, coachInManual: false };

describe('useRoastView', () => {
  it("keeps the window's edge when the expected end moves earlier mid-roast", () => {
    renderApp(<Probe first={start} />, { settings });
    expect(screen.getByText('edge 720 floor 50')).toBeInTheDocument();
    act(() => {
      setMoment((m) => ({ ...m, nowS: 301, ghost: { dropS: 500, tpC: 88 } }));
    });
    expect(screen.getByText('edge 720 floor 50')).toBeInTheDocument();
  });

  it('steps the floor straight down for a dip below it, never back up', () => {
    renderApp(<Probe first={start} />, { settings });
    act(() => {
      setMoment((m) => ({ ...m, nowS: 301, lowestC: 20 }));
    });
    expect(screen.getByText('edge 720 floor 0')).toBeInTheDocument();
    act(() => {
      setMoment((m) => ({ ...m, nowS: 302, lowestC: 90 }));
    });
    expect(screen.getByText('edge 720 floor 0')).toBeInTheDocument();
  });

  it('starts afresh for the next roast', () => {
    renderApp(<Probe first={start} />, { settings });
    act(() => {
      setMoment((m) => ({ ...m, nowS: 301, lowestC: 20 }));
    });
    act(() => {
      setMoment((m) => ({
        ...m,
        roast: { ...roasting, chargedAtMs: 900_000 },
        nowS: 10,
        lowestC: 90,
      }));
    });
    expect(screen.getByText('edge 720 floor 50')).toBeInTheDocument();
  });
});
