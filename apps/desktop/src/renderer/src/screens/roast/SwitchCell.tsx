import { Switch } from '@roastpilot/ui';

/** One labelled on/off for the switch row under the sliders. */
export function SwitchCell({
  label,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-md bg-surface-raised px-3 py-2">
      <span className="text-label text-ink-muted" aria-hidden="true">
        {label}
      </span>
      <Switch aria-label={label} checked={on} disabled={disabled} onChange={onToggle} />
    </div>
  );
}
