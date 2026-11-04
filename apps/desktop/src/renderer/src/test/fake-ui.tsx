import type { RoastChartProps } from '@roastpilot/ui';

/**
 * The real chart needs a canvas, which jsdom doesn't have; its own tests live in packages/ui.
 * The layer ids are kept on `data-layers` so screens can check what they would draw.
 */
export function FakeRoastChart({ title, action, layers }: RoastChartProps) {
  return (
    <section aria-label={title} data-layers={layers.map((l) => l.id).join(' ')}>
      {action}
    </section>
  );
}
