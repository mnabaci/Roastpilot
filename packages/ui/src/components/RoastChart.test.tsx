import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartLayer } from './roast-chart/chart-layer';

interface Created {
  opts: {
    height: number;
    scales: { x: { range: unknown } };
    series: { stroke?: string; width?: number; paths?: unknown; scale?: string }[];
  };
  data: unknown[][];
}
const created: Created[] = [];
const setData = vi.fn();
const destroy = vi.fn();

vi.mock('uplot', () => ({
  default: class {
    static paths = { stepped: () => 'stepped-path' };
    constructor(opts: Created['opts'], data: unknown[][]) {
      created.push({ opts, data });
    }
    setData = setData;
    destroy = destroy;
    redraw = vi.fn();
    setSize = vi.fn();
  },
}));

const { RoastChart } = await import('./RoastChart');

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
    render(<RoastChart title="Roast curve" layers={[bt([[0, 180]]), ror]} />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('Temperature');
    expect(legend).toHaveTextContent('RoR');
  });

  it('describes the latest values for screen readers', () => {
    render(
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

  it('says so when there are no readings', () => {
    render(<RoastChart title="Roast curve" layers={[bt([])]} />);
    expect(screen.getByRole('img', { name: 'No readings yet' })).toBeInTheDocument();
  });

  it('draws each layer with its token colour and width', () => {
    render(<RoastChart title="Roast curve" layers={[bt([[0, 180]]), ror]} />);
    expect(created).toHaveLength(1);
    expect(created[0]?.opts.series.slice(1).map((s) => [s.stroke, s.width])).toEqual([
      ['rgb(255, 122, 77)', 3.5],
      ['rgb(76, 211, 240)', 2],
    ]);
  });

  it('pushes new points with setData instead of rebuilding the chart', () => {
    const { rerender } = render(<RoastChart title="Roast curve" layers={[bt([[0, 180]])]} />);
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
    const { rerender, unmount } = render(
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
      render(
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
        ['output', 'stepped-path'],
        ['output', 'stepped-path'],
      ]);
    });

    it('gives both plots the same times, so they line up', () => {
      render(
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
      render(<RoastChart title="Roast curve" layers={[bt([[0, 180]]), heater, fan]} />);
      expect(screen.getByRole('list', { name: 'Outputs legend' })).toHaveTextContent('Heater');
      expect(screen.getByRole('list', { name: 'Legend' })).not.toHaveTextContent('Heater');
      expect(screen.getByRole('img', { name: 'Heater 70%, Fan 50%' })).toBeInTheDocument();
    });

    it('has no strip without output layers', () => {
      render(<RoastChart title="Roast curve" layers={[bt([[0, 180]])]} />);
      expect(created).toHaveLength(1);
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });
  });
});
