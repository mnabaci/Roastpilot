import { Button, cn, Tooltip, type ButtonProps } from '@roastpilot/ui';
import { GripVertical } from 'lucide-react';

/**
 * The ⠿ handle that moves a step: drag it, or focus it and press Alt+↑ / Alt+↓ (or Space to pick
 * it up). The drag's listeners and attributes come in as props.
 */
export function StepHandle({ name, className, ...props }: { name: string } & ButtonProps) {
  return (
    <Tooltip content="Drag, or Alt+↑ / Alt+↓">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Move ${name}`}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        className={cn(
          'cursor-grab touch-none px-0 text-ink-muted active:cursor-grabbing',
          className,
        )}
        icon={<GripVertical aria-hidden="true" />}
        {...props}
      />
    </Tooltip>
  );
}
