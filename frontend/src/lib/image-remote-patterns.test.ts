import { describe, expect, it } from "vitest";
import { getRemoteImagePatterns } from "./image-remote-patterns";

describe("getRemoteImagePatterns", () => {
  it("returns localhost defaults when no env override is configured", () => {
    expect(getRemoteImagePatterns(undefined)).toEqual([
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
    ]);
  });

  it("parses comma-separated hostnames as https image hosts", () => {
    expect(getRemoteImagePatterns("cdn.myfans.app, media.myfans.app")).toEqual([
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
      { protocol: "https", hostname: "cdn.myfans.app", pathname: "/**" },
      { protocol: "https", hostname: "media.myfans.app", pathname: "/**" },
    ]);
  });

  it("parses full URLs with protocol, port, and path", () => {
    expect(
      getRemoteImagePatterns("https://cdn.myfans.app/assets, http://localhost:4000/uploads"),
    ).toEqual([
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
      { protocol: "https", hostname: "cdn.myfans.app", pathname: "/assets/**" },
      { protocol: "http", hostname: "localhost", port: "4000", pathname: "/uploads/**" },
    ]);
  });

  it("deduplicates repeated entries", () => {
    expect(getRemoteImagePatterns("localhost,cdn.myfans.app,cdn.myfans.app")).toEqual([
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
      { protocol: "https", hostname: "cdn.myfans.app", pathname: "/**" },
    ]);
  });
});
