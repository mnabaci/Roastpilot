import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import type uPlot from 'uplot';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoastChart } from './RoastChart';
import type { ChartLayer } from './roast-chart/chart-layer';
import { PlotEngineProvider, type PlotEngine } from './roast-chart/plot-engine';

interface Created {
  opts: {
    height: number;
    scales: { x: { range: unknown } };
    series: { stroke?: string; width?: number; paths?: unknown; scale?: string }[];
    hooks: { setCursor?: ((u: unknown) => void)[] };
  };
  data: unknown[][];
}
const created: Created[] = [];
const setData = vi.fn();
const destroy = vi.fn();
const stepped: uPlot.Series.PathBuilder = () => null;

// jsdom has no canvas: this engine only records what the chart asks it to draw.
const engine: PlotEngine = {
  create: (opts, data) => {
    created.push({ opts, data } as unknown as Created);
    return { setData, destroy, redraw: vi.fn(), setSize: vi.fn() };
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

const bt = (points: [number, number][]): ChartLayer => ({
  id: 'bt',
  label: 'Temperature',
  axis: 'temperature',
  tone: 'heat',
  width: 3.5,
  points: points.map(([t, v]) => ({ t, v })),
});
const ror: ChartLayer = {
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
});
