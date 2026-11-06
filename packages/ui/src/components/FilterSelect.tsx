import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { cn } from '../lib/utils';

export interface FilterSelectProps<V extends string> {
  /** What it filters, shown before the choice: "Bean". */
  label: string;
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  /** The value that means "no filter": the chip stays quiet then. */
  allValue?: V;
  className?: string;
}

/**
 * A compact filter chip over a native select, so keyboard and screen readers work as usual (design
 * system: FilterSelect). With `allValue` it reads "Bean ▾" until it filters, then the choice in
 * ember ("Ethiopia Guji ▾"); without, "Compare: None ▾".
 */
export function FilterSelect<V extends string>({
  label,
  options,
  value,
  onChange,
  allValue,
  className,
}: FilterSelectProps<V>) {
  const id = useId();
  const current = options.find((o) => o.value === value)?.label ?? '';
  const filtering = allValue !== undefined && value !== allValue;
  return (
    <div
      className={cn(
        'relative flex h-control-sm min-w-0 items-center justify-center gap-0.5 rounded-md px-2.5 text-label has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
        filtering ? 'bg-heat-tint text-heat' : 'bg-surface-raised text-ink hover:bg-surface-hover',
        className,
      )}
    >
      {/* Narrow sidebars: the name while unfiltered, the choice while filtering. */}
      <span aria-hidden="true" title={`${label}: ${current}`} className="min-w-0 truncate">
        {allValue === undefined ? (
          <>
            <span className="text-ink-muted">{label}:</span> {current}
          </>
        ) : filtering ? (
          current
        ) : (
          label
        )}
      </span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => {
          // Only values from `options` can be picked.
          onChange(event.target.value as V);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
