import { Badge, Button } from '@roastpilot/ui';

/** A switch built from Button: the label stays, the badge says On or Off. */
export function OnOffButton({
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
    <Button
      aria-pressed={on}
      disabled={disabled}
      className="justify-between"
      onClick={() => {
        onToggle(!on);
      }}
    >
      {label}
      <Badge tone={on ? 'heat' : 'neutral'}>{on ? 'On' : 'Off'}</Badge>
    </Button>
  );
}
