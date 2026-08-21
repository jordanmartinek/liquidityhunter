import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-4xl">💥</div>
            <h1 className="text-xl font-bold text-red-400">Something crashed</h1>
            <p className="text-sm text-zinc-400">{this.state.error?.message || 'Unknown error'}</p>
            <pre className="text-[10px] text-left text-zinc-500 bg-zinc-900 p-3 rounded overflow-auto max-h-40">
              {this.state.error?.stack?.slice(0, 500)}
            </pre>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '/'; window.location.reload(); }}
              className="px-4 py-2 bg-teal-500 text-zinc-950 rounded font-medium text-sm"
            >
              Reset & Go Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
