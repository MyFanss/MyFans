import Image from 'next/image';
import { BookmarkButton } from '@/components/BookmarkButton';
import { FeatureGate } from '@/components/FeatureGate';
import { SubscriptionStatusBadge } from '@/components/subscription/SubscriptionStatusBadge';
import { FeatureFlag } from '@/lib/feature-flags';
import {
  getSubscriptionStatusCopy,
  type SubscriptionStatus,
} from '@/lib/subscription-status';
import type { CreatorProfile } from '@/lib/creator-profile';

interface CreatorHeroProps {
  creator: CreatorProfile;
  viewerSubscriptionStatus?: SubscriptionStatus | null;
}

export function CreatorHero({
  creator,
  viewerSubscriptionStatus = null,
}: CreatorHeroProps) {
  const statusCopy = viewerSubscriptionStatus
    ? getSubscriptionStatusCopy(viewerSubscriptionStatus)
    : null;

  return (
    <header className="relative">
      <div className="h-40 bg-gradient-to-br from-primary-500 to-primary-800 dark:from-primary-700 dark:to-primary-900 sm:h-52" />
      <div className="relative mx-auto -mt-16 max-w-5xl px-4 sm:-mt-20 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gray-200 dark:border-gray-900 dark:bg-gray-700 sm:h-32 sm:w-32">
            {creator.avatarUrl ? (
              <Image
                src={creator.avatarUrl}
                alt=""
                width={128}
                height={128}
                className="h-full w-full object-cover"
                priority
              />
            ) : (
              <span className="text-3xl font-bold text-gray-500 dark:text-gray-400 sm:text-4xl">
                {creator.displayName.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                {creator.displayName}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">@{creator.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {creator.subscriberCount.toLocaleString()} subscribers
                </p>
                {viewerSubscriptionStatus && (
                  <SubscriptionStatusBadge status={viewerSubscriptionStatus} />
                )}
              </div>
              {statusCopy && (
                <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
                  {statusCopy.helperText}
                </p>
              )}
              {creator.bio && (
                <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">
                  {creator.bio}
                </p>
              )}
              {creator.socialLinks.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-3" aria-label="Social links">
                  {creator.socialLinks.map((link) => (
                    <li key={link.platform}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:underline dark:text-primary-400"
                      >
                        {link.label ?? link.platform}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex-shrink-0">
              <FeatureGate flag={FeatureFlag.BOOKMARKS}>
                <BookmarkButton
                  creatorId={creator.id}
                  showLabel
                  className="shadow-sm shadow-black/5"
                />
              </FeatureGate>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default CreatorHero;
