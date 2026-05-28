import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import DiscoverContent from "./DiscoverContent";
import { afterEach } from "node:test";

const useSearchParamsMock = vi.fn(() => new URLSearchParams());
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
  useRouter: () => ({ replace: replaceMock }),
}));

const creators = [
  {
    id: "creator-1",
    username: "creator-a",
    displayName: "Creator A",
    avatarUrl: "/avatar-a.png",
    bio: "Bio A",
    subscriberCount: 100,
    subscriptionPrice: 5,
    isVerified: false,
    categories: ["Art"],
    location: "NY",
  },
  {
    id: "creator-2",
    username: "creator-b",
    displayName: "Creator B",
    avatarUrl: "/avatar-b.png",
    bio: "Bio B",
    subscriberCount: 200,
    subscriptionPrice: 10,
    isVerified: true,
    categories: ["Music"],
    location: "LA",
  },
];

const getCreatorsMock = vi.fn(
  ({ search = "", categories = [], sort = "popular", limit = 12 }) => {
    const sorted = sort === "recent" ? [creators[1], creators[0]] : creators;
    const filtered = sorted.filter((creator) => {
      const matchesSearch =
        !search ||
        creator.displayName.toLowerCase().includes(search.toLowerCase()) ||
        creator.username.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        categories.length === 0 ||
        categories.some((category: string) =>
          creator.categories.includes(category),
        );

      return matchesSearch && matchesCategory;
    });

    return {
      creators: filtered.slice(0, limit),
      total: filtered.length,
      hasMore: false,
    };
  },
);

vi.mock("@/lib/creator-profile", () => ({
  CATEGORIES: ["Art", "Music"],
  SORT_OPTIONS: [
    { value: "popular", label: "Popular" },
    { value: "recent", label: "Recent" },
  ],
  getCreators: getCreatorsMock,
}));

vi.mock("@/components/cards", () => ({
  CreatorCard: ({ name, username }: { name: string; username: string }) => (
    <div>{`${name} (${username})`}</div>
  ),
}));

vi.mock("@/components/FeatureGate", () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/BookmarkButton", () => ({
  BookmarkButton: ({ creatorId }: { creatorId: string }) => (
    <button type="button">Bookmark {creatorId}</button>
  ),
}));

beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver,
  );
});

describe("DiscoverContent", () => {
  beforeEach(() => {
    getCreatorsMock.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    replaceMock.mockReset();

    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function renderDiscoverContent() {
    render(<DiscoverContent />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });
  }

  it("renders the search input and category filters", async () => {
    await renderDiscoverContent();

    expect(
      screen.getByPlaceholderText("Search creators..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Art" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Music" })).toBeInTheDocument();
  });

  it("debounces search input before fetching filtered results", async () => {
    await renderDiscoverContent();

    expect(getCreatorsMock).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByPlaceholderText("Search creators...");
    fireEvent.change(searchInput, { target: { value: "Creator B" } });

    expect(getCreatorsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(316);
    });

    await waitFor(() => {
      expect(getCreatorsMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Creator B (creator-b)")).toBeInTheDocument();
    });
  });

  it("toggles category filters on and off", async () => {
    await renderDiscoverContent();

    const artButton = screen.getByRole("button", { name: "Art" });
    fireEvent.click(artButton);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });

    await waitFor(() => {
      expect(screen.getByText("Art ×")).toBeInTheDocument();
      expect(getCreatorsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ categories: ["Art"] }),
      );
      expect(screen.getByText("Creator A (creator-a)")).toBeInTheDocument();
    });

    fireEvent.click(artButton);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });

    await waitFor(() => {
      expect(screen.queryByText("Art ×")).not.toBeInTheDocument();
    });
  });

  it("updates displayed results when sort changes", async () => {
    await renderDiscoverContent();

    const sortSelect = screen.getByRole("combobox");
    fireEvent.change(sortSelect, { target: { value: "recent" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });

    await waitFor(() => {
      expect(getCreatorsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "recent" }),
      );
      expect(screen.getByText("Creator B (creator-b)")).toBeInTheDocument();
    });
  });

  it("clears filters and resets displayed creators", async () => {
    await renderDiscoverContent();

    const searchInput = screen.getByPlaceholderText("Search creators...");
    const artButton = screen.getByRole("button", { name: "Art" });

    fireEvent.change(searchInput, { target: { value: "Creator B" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(316);
    });

    fireEvent.click(artButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });

    const clearButton = screen.getByRole("button", {
      name: "Clear all filters",
    });
    fireEvent.click(clearButton);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });

    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(screen.queryByText("Art ×")).not.toBeInTheDocument();
      expect(screen.getByText("Creator A (creator-a)")).toBeInTheDocument();
      expect(screen.getByText("Creator B (creator-b)")).toBeInTheDocument();
    });
  });

  it("shows an empty state when no creators match filters", async () => {
    await renderDiscoverContent();

    const searchInput = screen.getByPlaceholderText("Search creators...");
    fireEvent.change(searchInput, { target: { value: "No match" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(316);
    });

    await waitFor(() => {
      expect(screen.getByText("No creators found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Try adjusting your search or filters to find more creators",
        ),
      ).toBeInTheDocument();
    });
  });
});
