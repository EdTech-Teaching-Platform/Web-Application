import { Component } from "react";
import { Link } from "react-router-dom";
import Button from "../ui/Button";

export default class StudentErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Student portal render failure", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-20">
        <div className="max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-danger">Something went wrong</p>
          <h1 className="mt-3 font-display text-2xl font-bold text-text">Unable to load this page</h1>
          <p className="mt-2 text-sm text-text/60">The page hit an unexpected error. You can retry it or return to your learning home.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button fullWidth={false} onClick={() => window.location.reload()}>Try again</Button>
            <Button as={Link} to="/student/dashboard" fullWidth={false} variant="secondary">Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }
}
