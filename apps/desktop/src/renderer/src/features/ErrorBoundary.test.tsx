import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ fail }: { fail: boolean }) {
  if (fail) throw new Error('boom');
  return <p>drawn</p>;
}

const renderBoundary = (fail: boolean, resetKey: string, onError = vi.fn()) => (
  <ErrorBoundary
    resetKey={resetKey}
    onError={onError}
    fallback={(error) => <p>failed: {(error as Error).message}</p>}
  >
    <Boom fail={fail} />
  </ErrorBoundary>
);

describe('ErrorBoundary', () => {
  // React reports caught render errors on console.error; keep the test output quiet.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  it('draws the children when nothing fails', () => {
    render(renderBoundary(false, 'a'));
    expect(screen.getByText('drawn')).toBeInTheDocument();
  });

  it('shows the fallback with the error and reports it once', () => {
    const onError = vi.fn();
    render(renderBoundary(true, 'a', onError));
    expect(screen.getByText('failed: boom')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]?.[0]).toEqual(new Error('boom'));
  });

  it('stays failed on a redraw with the same key', () => {
    const { rerender } = render(renderBoundary(true, 'a'));
    rerender(renderBoundary(false, 'a'));
    expect(screen.getByText('failed: boom')).toBeInTheDocument();
  });

  it('draws the children again when the key changes', () => {
    const { rerender } = render(renderBoundary(true, 'a'));
    rerender(renderBoundary(false, 'b'));
    expect(screen.getByText('drawn')).toBeInTheDocument();
  });
});
