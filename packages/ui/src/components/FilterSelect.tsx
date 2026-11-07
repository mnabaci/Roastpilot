import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Select, type SelectOption } from './Select';

export interface FilterSelectProps<V extends string> {
  /** What it filters, shown before the choice: "Bean". */
  label: string;
  options: readonly SelectOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** The value that means "no filter": the chip stays quiet then. */
  allValue?: V;
  className?: string;
}

/**
 * A compact filter chip that opens the app's own panel (design system: FilterSelect, Select). With
 * `allValue` it reads "Bean ▾" until it filters, then the choice in ember ("Ethiopia Guji ▾");
 * without, "Compare: None ▾".
 */
export function FilterSelect<V extends string>({
  label,
  options,
  value,
  onChange,
  allValue,
  className,
}: FilterSelectProps<V>) {
  const current = options.find((o) => o.value === value)?.label ?? '';
  const filtering = allValue !== undefined && value !== allValue;
  return (
    <Select
      label={label}
      aria-label={current ? `${label}: ${current}` : label}
      value={value}
      options={options}
      onChange={onChange}
      className={cn(
        'group flex h-control-sm min-w-0 items-center justify-center gap-0.5 rounded-md px-2.5 text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        filtering ? 'bg-heat-tint text-heat' : 'bg-surface-raised text-ink hover:bg-surface-hover',
        className,
      )}
    >
      {/* Narrow sidebars: the name while unfiltered, the choice while filtering. */}
      <span title={`${label}: ${current}`} className="min-w-0 truncate">
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
      <ChevronDown
        aria-hidden="true"
        className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
      />
    </Select>
  );
}
