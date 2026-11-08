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
  ghost: { dropS?: number; tpC?: number; loading?: boolean };
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
/** The saved roasts load after the first render, as in the app. */
const savedRoastsLoaded = () =>
  act(async () => {
    await Promise.resolve();
  });

describe('useRoastView', () => {
  it("keeps the window's edge when the expected end moves earlier mid-roast", async () => {
    renderApp(<Probe first={start} />, { settings });
    await savedRoastsLoaded();
    expect(screen.getByText('edge 720 floor 50')).toBeInTheDocument();
    act(() => {
      setMoment((m) => ({ ...m, nowS: 301, ghost: { dropS: 500, tpC: 88 } }));
    });
    expect(screen.getByText('edge 720 floor 50')).toBeInTheDocument();
  });

  it('steps the floor straight down for a dip below it, never back up', async () => {
    renderApp(<Probe first={start} />, { settings });
    await savedRoastsLoaded();
    act(() => {
      setMoment((m) => ({ ...m, nowS: 301, lowestC: 20 }));
    });
    expect(screen.getByText('edge 720 floor 0')).toBeInTheDocument();
    act(() => {
      setMoment((m) => ({ ...m, nowS: 302, lowestC: 90 }));
    });
    expect(screen.getByText('edge 720 floor 0')).toBeInTheDocument();
  });

  it('starts afresh for the next roast', async () => {
    renderApp(<Probe first={start} />, { settings });
    await savedRoastsLoaded();
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

  it('keeps its window and floor when the Roast screen is left mid-roast and opened again', async () => {
    let show: (screen: boolean | 'again') => void = () => undefined;
    // A ghost turning at 120 °C and dropping at 15:00: floor 100, edge 16:00.
    const first: Moment = { ...start, ghost: { dropS: 900, tpC: 120 } };
    // Back on the Roast screen with the ghost still loading: nothing to expect yet.
    const back: Moment = { ...start, nowS: 302, ghost: {} };
    /** Another screen in between: the probe unmounts, as the Roast screen does. */
    function Screens() {
      const [shown, set] = useState<boolean | 'again'>(true);
      useEffect(() => {
        show = set;
      }, []);
      if (!shown) return <p>Settings</p>;
      return <Probe first={shown === 'again' ? back : first} />;
    }
    renderApp(<Screens />, { settings });
    await savedRoastsLoaded();
    act(() => {
      setMoment((m) => ({ ...m, nowS: 301, lowestC: 80 }));
    });
    expect(screen.getByText('edge 960 floor 75')).toBeInTheDocument();
    act(() => {
      show(false);
    });
    act(() => {
      show('again');
    });
    expect(screen.getByText('edge 960 floor 75')).toBeInTheDocument();
  });

  it('keeps no floor set while the ghost it starts from is still loading', async () => {
    // Opened mid-roast (a reload): the ghost isn't read yet, so 12:00 and the 50 °C default…
    renderApp(<Probe first={{ ...start, ghost: { loading: true } }} />, { settings });
    await savedRoastsLoaded();
    expect(screen.getByText('edge 780 floor 50')).toBeInTheDocument();
    // …until it is: then its drop and 100 °C turning point set them, as they would have at Start.
    act(() => {
      setMoment((m) => ({ ...m, nowS: 301, ghost: { dropS: 660, tpC: 100 } }));
    });
    expect(screen.getByText('edge 720 floor 75')).toBeInTheDocument();
  });
});
