import type { ReactNode } from 'react';

/**
 * The carried step, floating under the cursor: a copy of its rows in a table of its own, its
 * columns as wide as the real ones. Only a picture: hidden from screen readers and inert.
 */
export function StepOverlay({ widths, children }: { widths: number[]; children: ReactNode }) {
  return (
    <table aria-hidden="true" inert className="w-full table-fixed border-collapse">
      <colgroup>
        {widths.map((width, i) => (
          <col key={String(i)} style={{ width }} />
        ))}
      </colgroup>
      <tbody>{children}</tbody>
    </table>
  );
}
