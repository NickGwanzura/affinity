import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui';
import { logger } from '../utils/logger';
import { captureException } from '../utils/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  view?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  declare props: Props;

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const view = this.props.view;
    logger.error('View crashed', {
      view,
      err: error,
      stack: errorInfo.componentStack,
    });
    captureException(error, {
      view,
      componentStack: errorInfo.componentStack,
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Per-view inline fallback so a crash in one tab doesn't kill the shell.
      if (this.props.view) {
        return (
          <div className="p-8 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-[#18181b] mb-2">Something went wrong</h2>
            <p className="text-sm text-[#52525b] mb-4">
              The {this.props.view} view crashed. Reload the page or switch to another view.
            </p>
            <details className="text-xs text-[#71717a]">
              <summary>Error details</summary>
              <pre className="mt-2 p-3 bg-stone-50 border border-[#e7e5e4] overflow-auto">
                {this.state.error?.message || 'Unknown error'}
              </pre>
            </details>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
          <div className="bg-white  shadow-xl border border-zinc-200 p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-zinc-500 mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button onClick={() => window.location.reload()} fullWidth>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
