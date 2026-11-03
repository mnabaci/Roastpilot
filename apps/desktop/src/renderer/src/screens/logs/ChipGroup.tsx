import { Button, cn } from '@roastpilot/ui';

export interface Chip<T extends string> {
  id: T;
  label: string;
}

/** A row of on/off chips (design system: Button, On / off). */
export function ChipGroup<T extends string>({
  label,
  chips,
  isOn,
  onToggle,
}: {
  label: string;
  chips: readonly Chip<T>[];
  isOn: (id: T) => boolean;
  onToggle: (id: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {chips.map(({ id, label: text }) => (
        <Button
          key={id}
          size="sm"
          aria-pressed={isOn(id)}
          className={cn(isOn(id) && 'bg-heat-tint text-heat hover:bg-heat-tint')}
          onClick={() => {
            onToggle(id);
          }}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}
