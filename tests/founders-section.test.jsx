/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FoundersSection from "../src/public/components/landing/FoundersSection";

describe("landing founders section", () => {
  it("renders the heading and four founder cards, and a failed photo falls back to initials", () => {
    const { container } = render(<FoundersSection />);
    expect(container.querySelector("#founders")).not.toBeNull();
    expect(screen.getByText("Meet the founders")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(4);
    const img = screen.getByAltText(/Salim/);
    img.dispatchEvent(new Event("error"));
    expect(screen.getAllByText("S").length).toBeGreaterThan(0);
  });
});
