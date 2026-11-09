import { Button, cn, Tooltip, type ButtonProps } from '@roastpilot/ui';
import { useId } from 'react';

/**
 * A button that waits, dimmed, with why in the app's tooltip ("Disconnect first"). A disabled
 * button takes no pointer or focus, so one with a reason stays a button marked `aria-disabled`
 * that does nothing, and screen readers hear the reason as its description.
 */
export function WaitingButton({
  reason,
  disabled,
  onClick,
  className,
  ...props
}: ButtonProps & { reason?: string | undefined }) {
  const id = useId();
  if (!disabled || !reason) {
    return <Button disabled={disabled} onClick={onClick} className={className} {...props} />;
  }
  return (
    <>
      <Tooltip content={reason}>
        <Button
          {...props}
          aria-disabled="true"
          aria-describedby={id}
          className={cn('cursor-not-allowed opacity-50 active:scale-100', className)}
        />
      </Tooltip>
      <span id={id} hidden>
        {reason}
      </span>
    </>
  );
}
