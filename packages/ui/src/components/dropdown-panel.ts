/**
 * The one dropdown look (design system: Select): the panel that Select and Menu open, and its rows.
 * Radix marks a highlighted menu row `data-highlighted`, cmdk a highlighted option `data-selected`.
 */
export const DROPDOWN_PANEL =
  'z-50 flex flex-col gap-0.5 rounded-lg border border-border-strong bg-surface-raised p-1';

export const DROPDOWN_ROW =
  'flex min-h-control-sm cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-body outline-none select-none data-highlighted:bg-surface-hover data-[selected=true]:bg-surface-hover data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50';
