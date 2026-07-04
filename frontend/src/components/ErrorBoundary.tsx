import { Component, type ReactNode } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Human label for the contained region, e.g. "Topology workspace". */
  label?: string;
  /** Change this value (e.g. the current route) to auto-reset after navigation. */
  resetKey?: string | number;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <div className="nm-panel workspace-fault" role="alert">
        <div className="workspace-fault-icon" aria-hidden="true">
          <TriangleAlert size={28} />
        </div>
        <h3>{this.props.label ? `${this.props.label} hit an unexpected error` : "Something went wrong"}</h3>
        <p className="workspace-fault-detail">{this.state.error.message}</p>
        <p className="workspace-fault-hint">The rest of NetMap is unaffected. Retry, or switch pages and come back.</p>
        <button type="button" className="nm-btn nm-btn--secondary" onClick={() => this.setState({ error: null })}>
          <RotateCcw size={14} aria-hidden="true" /> Retry
        </button>
      </div>
    );
  }
}
