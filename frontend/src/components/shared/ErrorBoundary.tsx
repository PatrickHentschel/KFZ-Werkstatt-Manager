import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <p className="text-lg font-semibold">Etwas ist schiefgelaufen</p>
            <p className="text-sm text-muted-foreground">
              Ein unerwarteter Fehler ist aufgetreten.
            </p>
            <button
              className="text-sm text-primary underline"
              onClick={() => window.location.reload()}
            >
              Seite neu laden
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
