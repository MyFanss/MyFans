import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RootLayout, { metadata } from "./layout";

vi.mock("./providers", () => ({
  Providers: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers-marker">{children}</div>
  )),
}));

import { Providers } from "./providers";

describe("RootLayout", () => {
  it("renders the children sentinel", () => {
    const { container } = render(
      <RootLayout>
        <span data-testid="sentinel">sentinel</span>
      </RootLayout>,
    );

    expect(container.querySelector('[data-testid="sentinel"]')).not.toBeNull();
  });

  it("wraps the children with Providers", () => {
    const { container } = render(
      <RootLayout>
        <span data-testid="sentinel">sentinel</span>
      </RootLayout>,
    );

    const marker = container.querySelector('[data-testid="providers-marker"]');
    expect(marker).not.toBeNull();
    expect(marker?.querySelector('[data-testid="sentinel"]')).not.toBeNull();
    expect(Providers).toHaveBeenCalled();
  });

  it("exports the expected metadata", () => {
    expect(metadata.title).toBe("Handsoff");
    expect(metadata.description).toBe("Handsoff frontend application shell");
  });
});
