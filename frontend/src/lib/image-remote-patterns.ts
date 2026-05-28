import type { RemotePattern } from "next/dist/shared/lib/image-config";

const DEFAULT_REMOTE_IMAGE_HOSTS = ["http://localhost", "http://127.0.0.1"];
const DEFAULT_PROTOCOL = "https";

function normalizeEntry(entry: string): string | null {
  const trimmed = entry.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPattern(entry: string): RemotePattern {
  if (entry === "localhost" || entry === "127.0.0.1") {
    return {
      protocol: "http",
      hostname: entry,
      pathname: "/**",
    };
  }

  if (entry.includes("://")) {
    const url = new URL(entry);

    return {
      protocol: url.protocol.replace(":", "") as RemotePattern["protocol"],
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: url.pathname && url.pathname !== "/" ? `${url.pathname.replace(/\/$/, "")}/**` : "/**",
    };
  }

  return {
    protocol: DEFAULT_PROTOCOL,
    hostname: entry,
    pathname: "/**",
  };
}

export function getRemoteImagePatterns(
  rawValue = process.env.NEXT_PUBLIC_IMAGE_REMOTE_PATTERNS,
): RemotePattern[] {
  const configuredEntries =
    rawValue
      ?.split(",")
      .map(normalizeEntry)
      .filter((entry): entry is string => entry !== null) ?? [];

  const uniqueEntries = [...new Set([...DEFAULT_REMOTE_IMAGE_HOSTS, ...configuredEntries])];
  const uniquePatterns = new Map<string, RemotePattern>();

  for (const entry of uniqueEntries) {
    const pattern = toPattern(entry);
    const key = [pattern.protocol, pattern.hostname, pattern.port ?? "", pattern.pathname ?? ""].join("|");
    if (!uniquePatterns.has(key)) {
      uniquePatterns.set(key, pattern);
    }
  }

  return [...uniquePatterns.values()];
}
