import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import type uPlot from 'uplot';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoastChart } from './RoastChart';
import type { ChartAid, ChartLayer, LineLayer } from './roast-chart/chart-layer';
import { PlotEngineProvider, type PlotEngine } from './roast-chart/plot-engine';

type Range = (u: unknown, min: number, max: number, scale: string) => [number, number];
interface Created {
  opts: {
    height: number;
    scales: { x: { range: Range }; temperature?: { range: Range } };
    series: { stroke?: string; width?: number; paths?: unknown; scale?: string }[];
    hooks: {
      setCursor?: ((u: unknown) => void)[];
      drawClear?: ((u: unknown) => void)[];
      draw?: ((u: unknown) => void)[];
    };
  };
  data: unknown[][];
}
const created: Created[] = [];
const setData = vi.fn();
const destroy = vi.fn();
const redraw = vi.fn();
const stepped: uPlot.Series.PathBuilder = () => null;

// jsdom has no canvas: this engine only records what the chart asks it to draw.
const engine: PlotEngine = {
  create: (opts, data) => {
    created.push({ opts, data } as unknown as Created);
    return { setData, destroy, redraw, setSize: vi.fn() };
  },
  stepped: () => stepped,
};
const withEngine = (ui: ReactElement) => (
  <PlotEngineProvider value={engine}>{ui}</PlotEngineProvider>
);
const draw = (ui: ReactElement) => {
  const view = render(withEngine(ui));
  const rerender = (next: ReactElement) => {
    view.rerender(withEngine(next));
  };
  return { ...view, rerender };
};

const bt = (points: [number, number][]): LineLayer => ({
  id: 'bt',
  label: 'Temperature',
  axis: 'temperature',
  tone: 'heat',
  width: 3.5,
  points: points.map(([t, v]) => ({ t, v })),
});
const ror: LineLayer = {
  id: 'ror',
  label: 'RoR',
  axis: 'ror',
  tone: 'air',
  width: 2,
  points: [{ t: 30, v: 9.4 }],
};

beforeEach(() => {
  created.length = 0;
  setData.mockClear();
  destroy.mockClear();
  redraw.mockClear();
  document.documentElement.style.setProperty('--heat', 'rgb(255, 122, 77)');
  document.documentElement.style.setProperty('--air', 'rgb(76, 211, 240)');
});

describe('RoastChart', () => {
  it('shows a legend entry per layer above the chart', () => {
    draw(<RoastChart title="Roast curve" layers={[bt([[0, 180]]), ror]} />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('Temperature');
    expect(legend).toHaveTextContent('RoR');
  });

  it('describes the latest values for screen readers', () => {
    draw(
      <RoastChart
        title="Roast curve"
        layers={[
          bt([
            [0, 180],
            [30, 171.25],
          ]),
          ror,
        ]}
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Temperature 171.3 °C, RoR 9.4 °C/min' }),
    ).toBeInTheDocument();
  });

  it('hovering shows the time and each value there, and leaving brings the names back', () => {
    draw(
      <RoastChart
        title="Roast curve"
        layers={[
          bt([
            [0, 180],
            [30, 171.25],
          ]),
          ror,
        ]}
      />,
    );
    const hover = (left: number, t: number) => {
      act(() => {
        for (const hook of created[0]?.opts.hooks.setCursor ?? [])
          hook({ cursor: { left }, posToVal: () => t });
      });
    };
    const legend = screen.getByRole('list', { name: 'Legend' });
    hover(120, 12);
    expect(screen.getByText('0:12')).toBeInTheDocument();
    expect(legend).toHaveTextContent('Temperature180.0 °C');
    // RoR has no value yet at 0:12: a dash, never a stale or made-up number.
    expect(legend).toHaveTextContent('RoR–');
    hover(-10, 0);
    expect(screen.queryByText('0:12')).not.toBeInTheDocument();
    expect(legend).toHaveTextContent('TemperatureRoR');
  });

  it('shows a control beside its title', () => {
    draw(
      <RoastChart
        title="Roast curve"
        titleAction={<button type="button">Show preheat</button>}
        layers={[bt([[0, 180]])]}
      />,
    );
    expect(screen.getByRole('region', { name: 'Roast curve' })).toContainElement(
      screen.getByRole('button', { name: 'Show preheat' }),
    );
  });

  it('says so when there are no readings', () => {
    draw(<RoastChart title="Roast curve" layers={[bt([])]} />);
    expect(screen.getByRole('img', { name: 'No readings yet' })).toBeInTheDocument();
  });

  it('draws each layer with its token colour and width', () => {
    draw(<RoastChart title="Roast curve" layers={[bt([[0, 180]]), ror]} />);
    expect(created).toHaveLength(1);
    expect(created[0]?.opts.series.slice(1).map((s) => [s.stroke, s.width])).toEqual([
      ['rgb(255, 122, 77)', 3.5],
      ['rgb(76, 211, 240)', 2],
    ]);
  });

  it('pushes new points with setData instead of rebuilding the chart', () => {
    const { rerender } = draw(<RoastChart title="Roast curve" layers={[bt([[0, 180]])]} />);
    rerender(
      <RoastChart
        title="Roast curve"
        layers={[
          bt([
            [0, 180],
            [1, 179],
          ]),
        ]}
      />,
    );
    expect(created).toHaveLength(1);
    expect(setData).toHaveBeenLastCalledWith([
      [0, 1],
      [180, 179],
    ]);
  });

  it('rebuilds when a layer is added, and cleans up on unmount', () => {
    const { rerender, unmount } = draw(
      <RoastChart title="Roast curve" layers={[bt([[0, 180]])]} />,
    );
    rerender(<RoastChart title="Roast curve" layers={[bt([[0, 180]]), ror]} />);
    expect(created).toHaveLength(2);
    unmount();
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  describe('outputs strip', () => {
    const output = (id: string, tone: 'heat' | 'air', points: [number, number][]): ChartLayer => ({
      id,
      label: id === 'heater' ? 'Heater' : 'Fan',
      axis: 'output',
      tone,
      width: 2,
      step: true,
      points: points.map(([t, v]) => ({ t, v })),
    });
    const heater = output('heater', 'heat', [
      [0, 100],
      [60, 70],
    ]);
    const fan = output('fan', 'air', [
      [0, 30],
      [90, 50],
    ]);

    it('draws output layers in a strip under the chart, as steps', () => {
      draw(
        <RoastChart
          title="Roast curve"
          layers={[
            bt([
              [0, 180],
              [120, 150],
            ]),
            ror,
            heater,
            fan,
          ]}
        />,
      );
      expect(created).toHaveLength(2);
      const [chart, strip] = created;
      expect(chart?.opts.series.slice(1).map((s) => s.scale)).toEqual(['temperature', 'ror']);
      expect(strip?.opts.height).toBe(96);
      expect(strip?.opts.series.slice(1).map((s) => [s.scale, s.paths])).toEqual([
        ['output', stepped],
        ['output', stepped],
      ]);
    });

    it('gives both plots the same times, so they line up', () => {
      draw(
        <RoastChart
          title="Roast curve"
          layers={[
            bt([
              [0, 180],
              [120, 150],
            ]),
            heater,
            fan,
          ]}
        />,
      );
      const [chart, strip] = created;
      expect(chart?.data[0]).toEqual([0, 60, 90, 120]);
      expect(strip?.data[0]).toEqual(chart?.data[0]);
      expect(strip?.data[1]).toEqual([100, 70, undefined, undefined]);
    });

    it('lists the outputs in their own legend and describes their latest values', () => {
      draw(<RoastChart title="Roast curve" layers={[bt([[0, 180]]), heater, fan]} />);
      expect(screen.getByRole('list', { name: 'Outputs legend' })).toHaveTextContent('Heater');
      expect(screen.getByRole('list', { name: 'Legend' })).not.toHaveTextContent('Heater');
      expect(screen.getByRole('img', { name: 'Heater 70%, Fan 50%' })).toBeInTheDocument();
    });

    it('has no strip without output layers', () => {
      draw(<RoastChart title="Roast curve" layers={[bt([[0, 180]])]} />);
      expect(created).toHaveLength(1);
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });
  });

  describe('during a roast', () => {
    const roasting = bt([
      [-30, 180],
      [0, 179],
      [420, 175],
    ]);
    const aids: ChartAid[] = [
      {
        kind: 'phase-bands',
        id: 'phases',
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
    ];
    const heater: LineLayer = {
      id: 'heater',
      label: 'Heater',
      axis: 'output',
      tone: 'heat',
      width: 2,
      step: true,
      points: [{ t: 0, v: 80 }],
    };

    /** A plot that records what is drawn on it: x in seconds, y as 300 − °C. */
    const fakePlot = (pixelRatio = 1) => {
      const calls: { name: string; args: unknown[]; alpha: number; fill: unknown }[] = [];
      // The canvas as uPlot sized it: 1000 CSS px wide at `pixelRatio`.
      const state: Record<string, unknown> = {
        globalAlpha: 1,
        canvas: { width: 1000 * pixelRatio },
      };
      const ctx = new Proxy(state, {
        get: (target, name: string) =>
          name in target
            ? target[name]
            : name === 'measureText'
              ? () => ({ width: 40 })
              : (...args: unknown[]) => {
                  calls.push({
                    name,
                    args,
                    alpha: Number(target.globalAlpha),
                    fill: target.fillStyle,
                  });
                },
        set: (target, name: string, value) => {
          target[name] = value;
          return true;
        },
      });
      const u = {
        ctx,
        width: 1000,
        bbox: { left: 0, top: 0, width: 1000, height: 300 },
        scales: { temperature: { min: 50, max: 250 } },
        // The temperature line as drawn: -0:30, charge, 7:00.
        series: [{}, { scale: 'temperature' }],
        data: [
          [-30, 0, 420],
          [180, 179, 175],
        ],
        valToPos: (v: number, scale: string) => (scale === 'x' ? v : 300 - v),
      };
      return { u, calls };
    };
    const runHooks = (plot: Created | undefined, hook: 'drawClear' | 'draw') => {
      const { u, calls } = fakePlot();
      for (const fn of plot?.opts.hooks[hook] ?? []) fn(u);
      return calls;
    };

    it('shows the time window it is given, whatever the data spans', () => {
      draw(
        <RoastChart
          title="Roast curve"
          layers={[roasting]}
          timeWindow={{ fromS: -30, toS: 736 }}
        />,
      );
      expect(created[0]?.opts.scales.x.range({}, -900, 420, 'x')).toEqual([-30, 736]);
    });

    it('starts the temperature axis at the floor it is given', () => {
      draw(<RoastChart title="Roast curve" layers={[roasting]} temperatureFloorC={50} />);
      expect(created[0]?.opts.scales.temperature?.range({}, 92, 210, 'temperature')).toEqual([
        50, 250,
      ]);
    });

    it('takes a new window or floor without rebuilding, working the scales out again', () => {
      const { rerender } = draw(
        <RoastChart
          title="Roast curve"
          layers={[roasting]}
          timeWindow={{ fromS: -30, toS: 736 }}
        />,
      );
      setData.mockClear();
      rerender(
        <RoastChart
          title="Roast curve"
          layers={[roasting]}
          timeWindow={{ fromS: -30, toS: 737 }}
          temperatureFloorC={50}
        />,
      );
      expect(created).toHaveLength(1);
      expect(setData).toHaveBeenCalled();
      expect(created[0]?.opts.scales.x.range({}, -900, 420, 'x')).toEqual([-30, 737]);
      expect(created[0]?.opts.scales.temperature?.range({}, 92, 210, 'temperature')).toEqual([
        50, 250,
      ]);
    });

    it('fits the data again without a window', () => {
      draw(<RoastChart title="Roast curve" layers={[roasting]} />);
      expect(created[0]?.opts.scales.x.range({}, -900, 420, 'x')).toEqual([-900, 420]);
    });

    it('keeps the aids out of the legend, the description and the lines', () => {
      draw(<RoastChart title="Roast curve" layers={[roasting, ...aids]} />);
      expect(screen.getByRole('list', { name: 'Legend' }).querySelectorAll('li')).toHaveLength(1);
      expect(screen.getByRole('img', { name: 'Temperature 175.0 °C' })).toBeInTheDocument();
      expect(created[0]?.opts.series).toHaveLength(2);
    });

    it('takes each new reading as one setData and at most one redraw per plot, never a rebuild', () => {
      const at = (nowS: number): ChartLayer[] => [
        bt([
          [0, 179],
          [nowS, 175],
        ]),
        { ...heater, points: [{ t: nowS, v: 80 }] },
        ...aids.map((aid) => (aid.kind === 'now-line' ? { ...aid, t: nowS } : aid)),
      ];
      const window = (nowS: number) => ({ fromS: -30, toS: Math.max(736, nowS + 60) });
      const { rerender } = draw(
        <RoastChart title="Roast curve" layers={at(420)} timeWindow={window(420)} />,
      );
      for (let s = 421; s <= 430; s++) {
        setData.mockClear();
        redraw.mockClear();
        rerender(<RoastChart title="Roast curve" layers={at(s)} timeWindow={window(s)} />);
        expect(setData).toHaveBeenCalledTimes(2);
        expect(redraw.mock.calls.length).toBeLessThanOrEqual(2);
      }
      expect(created).toHaveLength(2);
      // The same layers again (a render with no new reading): nothing is drawn.
      const same = at(430);
      rerender(<RoastChart title="Roast curve" layers={same} timeWindow={window(430)} />);
      setData.mockClear();
      redraw.mockClear();
      rerender(<RoastChart title="Roast curve" layers={same} timeWindow={window(430)} />);
      expect(setData).not.toHaveBeenCalled();
      expect(redraw).not.toHaveBeenCalled();
    });

    it('turns aids on and off with a redraw, not a rebuild', () => {
      const { rerender } = draw(<RoastChart title="Roast curve" layers={[roasting]} />);
      rerender(<RoastChart title="Roast curve" layers={[roasting, ...aids]} />);
      expect(created).toHaveLength(1);
    });

    describe('with the band tokens', () => {
      const BANDS = {
        '--band-low': 'band-low',
        '--band-mid': 'band-mid',
        '--band-high': 'band-high',
        '--surface': 'surface',
      };
      beforeEach(() => {
        for (const [token, value] of Object.entries(BANDS))
          document.documentElement.style.setProperty(token, value);
        return () => {
          for (const token of Object.keys(BANDS))
            document.documentElement.style.removeProperty(token);
        };
      });

      it('draws the phase bands behind everything in their own tokens, coolest first', () => {
        draw(<RoastChart title="Roast curve" layers={[roasting, ...aids]} />);
        const calls = runHooks(created[0], 'drawClear');
        expect(calls.filter((c) => c.name === 'fillRect').map((c) => [c.args, c.fill])).toEqual([
          [[0, 150, 1000, 100], 'band-low'],
          [[0, 108, 1000, 42], 'band-mid'],
          [[0, 50, 1000, 58], 'band-high'],
        ]);
        expect(calls.filter((c) => c.name === 'fillText')).toEqual([]);
      });

      it('names each band inside it, centred, on a surface chip, clear of the curve', () => {
        draw(<RoastChart title="Roast curve" layers={[roasting, ...aids]} />);
        const calls = runHooks(created[0], 'draw');
        // Drying and development centred in their bands (y 150–250, 50–108); the temperature line
        // runs through Maillard's middle (y 121–125), so its name sits at the band's bottom.
        expect(calls.filter((c) => c.name === 'fillText').map((c) => c.args)).toEqual([
          ['Drying', 12, 200],
          ['Maillard', 12, 137],
          ['Development', 12, 79],
        ]);
        expect(calls.filter((c) => c.name === 'fillRect').map((c) => c.fill)).toEqual([
          'surface',
          'surface',
          'surface',
        ]);
      });
    });

    it('puts a marker label flipped left at the edge on its own row, clear of the one before', () => {
      draw(
        <RoastChart
          title="Roast curve"
          layers={[roasting]}
          markers={[
            { id: 'ghost-first-crack', label: 'Ghost FC', t: 900, tone: 'ghost' },
            { id: 'ghost-drop', label: 'Ghost drop', t: 990, tone: 'ghost' },
          ]}
        />,
      );
      const texts = runHooks(created[0], 'draw').filter((c) => c.name === 'fillText');
      expect(texts.map((c) => c.args)).toEqual([
        ['Ghost FC', 908, 16],
        ['Ghost drop', 942, 34],
      ]);
    });

    it('draws no current-point dot past the edge of the window', () => {
      draw(
        <RoastChart
          title="Roast curve"
          layers={[
            bt([
              [0, 180],
              [1200, 120],
            ]),
          ]}
        />,
      );
      const { u, calls } = fakePlot();
      u.data = [
        [0, 1200],
        [180, 120],
      ];
      for (const fn of created[0]?.opts.hooks.draw ?? []) fn(u);
      expect(calls.filter((c) => c.name === 'arc')).toEqual([]);
    });

    it("moves a band's name to its right edge when curves fill the left", () => {
      const one: ChartAid = { kind: 'phase-bands', id: 'phases', bands: [{ label: 'Drying' }] };
      draw(<RoastChart title="Roast curve" layers={[roasting, one]} />);
      const { u, calls } = fakePlot();
      // A line straight up the left edge, from the bottom of the axis to its top.
      u.data = [
        [10, 20],
        [50, 250],
      ];
      for (const fn of created[0]?.opts.hooks.draw ?? []) fn(u);
      expect(calls.filter((c) => c.name === 'fillText').map((c) => c.args)).toEqual([
        ['Drying', 948, 150],
      ]);
    });

    it('leaves a band too thin for its name unnamed', () => {
      const thin: ChartAid = {
        kind: 'phase-bands',
        id: 'phases',
        bands: [{ label: 'Maillard', fromC: 150, toC: 160 }],
      };
      draw(<RoastChart title="Roast curve" layers={[roasting, thin]} />);
      expect(runHooks(created[0], 'drawClear').filter((c) => c.name === 'fillRect')).toHaveLength(
        1,
      );
      expect(runHooks(created[0], 'draw').filter((c) => c.name === 'fillText')).toHaveLength(0);
    });

    it('draws the projection faint and dashed, from now to where it ends', () => {
      draw(<RoastChart title="Roast curve" layers={[roasting, ...aids]} />);
      const calls = runHooks(created[0], 'draw');
      const dash = calls.find((c) => c.name === 'setLineDash');
      expect(dash?.args).toEqual([[4, 4]]);
      expect(dash?.alpha).toBe(0.55);
      expect(calls.filter((c) => c.name === 'moveTo').map((c) => c.args)).toContainEqual([
        420, 125,
      ]);
      expect(calls.filter((c) => c.name === 'lineTo').map((c) => c.args)).toContainEqual([
        540, 107,
      ]);
    });

    it('draws the now line through the chart and the outputs strip', () => {
      draw(<RoastChart title="Roast curve" layers={[roasting, heater, ...aids]} />);
      const [chart, strip] = created;
      for (const plot of [chart, strip]) {
        const calls = runHooks(plot, 'draw');
        expect(calls.filter((c) => c.name === 'lineTo').map((c) => c.args)).toContainEqual([
          420, 300,
        ]);
      }
      // The strip has no bands or projection.
      expect(runHooks(strip, 'drawClear')).toEqual([]);
      expect(
        runHooks(strip, 'draw')
          .filter((c) => c.name === 'lineTo')
          .map((c) => c.args),
      ).not.toContainEqual([540, 107]);
    });

    it("sizes labels and lines by the canvas's pixel ratio, not the window's", () => {
      // The window already says 1 (moved to a normal display) while the canvas is still 2×, and
      // the other way round: what is drawn on top always matches the canvas under it.
      draw(
        <RoastChart
          title="Roast curve"
          layers={[roasting, ...aids]}
          markers={[{ id: 'charge', label: 'Charge', t: 0, tone: 'ink' }]}
        />,
      );
      const drawnAt = (pixelRatio: number) => {
        const { u, calls } = fakePlot(pixelRatio);
        for (const fn of created[0]?.opts.hooks.draw ?? []) fn(u);
        return {
          dash: calls.find((c) => c.name === 'setLineDash')?.args,
          dot: calls.find((c) => c.name === 'arc')?.args[2],
        };
      };
      expect(window.devicePixelRatio).toBe(1);
      expect(drawnAt(2)).toMatchObject({ dash: [[8, 8]], dot: 12 });
      expect(drawnAt(1)).toMatchObject({ dash: [[4, 4]], dot: 6 });
    });
  });
});
