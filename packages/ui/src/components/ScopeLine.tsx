import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Select, type SelectOption } from './Select';
import { Tooltip } from './Tooltip';

interface ScopeLineBase {
  /** What it picks, for screen readers: "Roaster". */
  label: string;
  className?: string;
}

export type ScopeLineProps<V extends string> = ScopeLineBase &
  (
    | {
        /** Which one the list shows; a choice opens the app's Select panel. */
        value: V;
        options: readonly SelectOption<V>[];
        onChange: (value: V) => void;
        text?: never;
        tooltip?: never;
      }
    | {
        /** Read only: what the list follows, and where you change it. */
        text: string;
        tooltip?: string;
        value?: never;
        options?: never;
        onChange?: never;
      }
  );

const LINE = 'flex h-6 max-w-full min-w-0 items-center gap-1 text-label text-ink-muted';

/**
 * Under a sidebar's title, what its list is of (design system: ScopeLine): History's roaster, as
 * a quiet picker ("Skywalker ▾"), or Profiles' as plain text. Not a filter chip: it says whose list
 * this is, so it never turns ember.
 */
export function ScopeLine<V extends string>(props: ScopeLineProps<V>) {
  const { label, className } = props;
  if (props.text !== undefined) {
    const line = (
      <span className={cn(LINE, 'self-start', className)}>
        <span className="sr-only">{label}: </span>
        <span className="truncate">{props.text}</span>
        {/* The tooltip's hint, for screen readers: the line itself takes no focus. */}
        {props.tooltip ? <span className="sr-only"> · {props.tooltip}</span> : null}
      </span>
    );
    return props.tooltip ? <Tooltip content={props.tooltip}>{line}</Tooltip> : line;
  }
  const current = props.options.find((o) => o.value === props.value)?.label ?? '';
  return (
    <Select
      label={label}
      aria-label={`${label}: ${current}`}
      value={props.value}
      options={props.options}
      onChange={props.onChange}
      className={cn(
        LINE,
        'group -mx-1 self-start rounded-sm px-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-focus',
        className,
      )}
    >
      <span className="truncate">{current}</span>
      <ChevronDown
        aria-hidden="true"
        className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180"
      />
    </Select>
  );
}
