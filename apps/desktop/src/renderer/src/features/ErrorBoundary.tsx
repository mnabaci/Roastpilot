import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** A change (e.g. opening another screen) clears the error and draws the children again. */
  resetKey?: unknown;
  /** Logs the error; called once per failure. */
  onError: (error: unknown, info: ErrorInfo) => void;
  /** What shows instead of the children while they are failed. */
  fallback: (error: unknown) => ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
  error: unknown;
  resetKey: unknown;
}

/**
 * Catches a render error below it so the window never goes blank (docs/spec/ui.md, Error page).
 * The one class component the renderer allows: React has no hook for this.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    failed: false,
    error: undefined,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { failed: true, error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.resetKey
      ? null
      : { failed: false, error: undefined, resetKey: props.resetKey };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError(error, info);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.state.error) : this.props.children;
  }
}
