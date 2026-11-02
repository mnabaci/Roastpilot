import type { RoastChartProps } from '@roastpilot/ui';

/** The real chart needs a canvas, which jsdom doesn't have; its own tests live in packages/ui. */
export function FakeRoastChart({ title }: RoastChartProps) {
  return <section aria-label={title} />;
}
