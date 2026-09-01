"use client";

/**
 * DiscoverStrip — a lightweight horizontal strip of featured creators
 * shown on the home page landing section (#1661).
 *
 * Data source: GET /api/v1/creators?limit=4
 * Falls back to an empty / hidden state rather than showing mock data.
 * No placeholder images are loaded; avatars are initials-only to avoid
 * LCP-inflating large images on the landing page.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchCreators, type PublicCreator } from "@/lib/api/creators";

interface DiscoverStripProps {
  /** Maximum number of creator cards to show. Default: 4. */
  limit?: number;
}

function InitialsAvatar({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials || "?"}
    </div>
  );
}

/** Stable colour derived from the creator's id/username. */
function creatorColor(id: string): string {
  const COLORS = [
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#10b981",
    "#f59e0b",
    "#06b6d4",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function CreatorCard({ creator }: { creator: PublicCreator }) {
  const color = creatorColor(creator.id);
  const displayName = creator.display_name || creator.username;

  return (
    <Link
      href={`/creator/${creator.username}`}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-surface-200 bg-white p-5 text-center transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 dark:border-surface-700 dark:bg-surface-800 dark:hover:shadow-surface-900/40"
      aria-label={`View ${displayName}'s profile`}
    >
      <InitialsAvatar name={displayName} color={color} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-surface-900 dark:text-white">
          {displayName}
        </p>
        {creator.is_verified && (
          <span
            className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400"
            aria-label="Verified creator"
          >
            ✓ Verified
          </span>
        )}
        {creator.followers_count > 0 && (
          <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
            {creator.followers_count.toLocaleString()} subscriber
            {creator.followers_count !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </Link>
  );
}

export function DiscoverStrip({ limit = 4 }: DiscoverStripProps) {
  const [creators, setCreators] = useState<PublicCreator[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    searchCreators({ limit })
      .then((result) => {
        if (cancelled) return;
        setCreators(result.data.slice(0, limit));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  // Hide strip entirely when no creators are available.
  if (status === "error" || (status === "ready" && creators.length === 0)) {
    return null;
  }

  return (
    <section
      id="creators"
      aria-labelledby="discover-strip-heading"
      className="w-full py-12"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2
          id="discover-strip-heading"
          className="mb-6 text-center text-xl font-semibold text-surface-700 dark:text-surface-300"
        >
          Featured on MyFans
        </h2>

        {status === "loading" ? (
          /* Skeleton — reserved height so CLS is minimal */
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
            aria-label="Loading featured creators"
            aria-busy="true"
          >
            {Array.from({ length: limit }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-700"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 px-5 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800"
          >
            Browse all creators
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
