import { Component } from "react";

// Shared error boundary for every portal's outlet (and lazy pages under it):
// a render crash or a failed lazy chunk shows a readable panel with Reload and
// Go back instead of a blank white screen, and is logged to the console.
// Pass resetKey (e.g. the pathname) so navigating away clears the error.
//   <ErrorBoundary resetKey={pathname} homeHref="/teacher/dashboard">…</ErrorBoundary>
export default class ErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error) {
    return { error: error || new Error("Unknown error") };
  }

  // A new resetKey (navigating to another page) clears the error.
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error, info) {
    // Logged for support; the panel only shows a short message.
    console.error(`[${this.props.name || "portal"}] render failure`, error, info?.componentStack || "");
    this.props.onError?.(error, info);
  }

  goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign(this.props.homeHref || "/");
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(String(error?.message));
    return (
      <div className="ul-error-panel">
        <div className="ul-error-panel__card" role="alert">
          <p className="ul-error-panel__eyebrow">Something went wrong</p>
          <h1 className="ul-error-panel__title">This page couldn&apos;t be shown</h1>
          <p className="ul-error-panel__text">
            {chunk
              ? "A newer version of the app is available, or the connection dropped. Reload to continue."
              : "The page hit an unexpected error. Reload it, or go back to where you were."}
          </p>
          {error?.message && <p className="ul-error-panel__detail">Details: {String(error.message).slice(0, 200)}</p>}
          <div className="ul-error-panel__actions">
            <button type="button" className="ul-confirm__btn ul-confirm__btn--primary" onClick={() => window.location.reload()}>Reload</button>
            <button type="button" className="ul-confirm__btn" onClick={this.goBack}>Go back</button>
          </div>
        </div>
      </div>
    );
  }
}
