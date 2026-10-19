import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the Handsoff heading", () => {
    const { container } = render(<HomePage />);

    const heading = container.querySelector("h1");
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe("Handsoff");
  });

  it("renders links to /dashboard and /demo", () => {
    const { container } = render(<HomePage />);

    expect(container.querySelector('a[href="/dashboard"]')).not.toBeNull();
    expect(container.querySelector('a[href="/demo"]')).not.toBeNull();
  });
});
