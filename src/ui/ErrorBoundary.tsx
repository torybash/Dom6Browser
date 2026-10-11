import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Keeps a rendering bug in one area from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-4 rounded-lg border border-bad/40 bg-bad/5 p-4 text-sm">
        <p className="font-medium text-bad">Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}.</p>
        <p className="mt-1 font-mono text-xs text-muted">{this.state.error.message}</p>
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button
            className="btn"
            onClick={() => {
              location.hash = '';
              location.reload();
            }}
          >
            Reset view
          </button>
        </div>
      </div>
    );
  }
}
