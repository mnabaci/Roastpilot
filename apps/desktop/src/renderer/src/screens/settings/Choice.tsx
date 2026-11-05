import { Button } from '@roastpilot/ui';

export interface ChoiceOption<T> {
  id: T;
  label: string;
}

/** One setting as a row of buttons, the chosen one pressed. */
export function Choice<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  /** Names the group for screen readers. */
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(({ id, label: optionLabel }) => (
        <Button
          key={String(id)}
          aria-pressed={value === id}
          className={value === id ? 'bg-heat-tint text-heat' : undefined}
          onClick={() => {
            onChange(id);
          }}
        >
          {optionLabel}
        </Button>
      ))}
    </div>
  );
}
