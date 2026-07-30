'use client';
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Optional: report to error tracking service
    console.error(`[ErrorBoundary:${this.props.section ?? 'unknown'}]`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center p-8 text-center"
      >
        <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
          Something went wrong
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Go home
          </a>
        </div>
      </div>
    );
  }
}
