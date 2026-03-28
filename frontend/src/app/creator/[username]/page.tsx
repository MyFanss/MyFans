import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getAllCreators,
  getCreatorByUsername,
  getCreatorPlans,
  getPreviewContent,
  getPosts,
  getCurrencySymbol,
  type CreatorProfile,
} from '@/lib/creator-profile';
import { getMockViewerSubscriptionStatus } from '@/lib/subscription-status';
import { createCreatorMetadata } from '@/lib/metadata';
import { CreatorHero } from '@/components/creator/CreatorHero';
import { PlanCard } from '@/components/cards';
import { ContentCard } from '@/components/cards';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * ISR: Regenerate creator pages at most once per minute.
 * Zero-cost for repeat visits within that window.
 */
export const revalidate = 60;

/**
 * Pre-render all known creator pages at build time (SSG).
 * Eliminates cold SSR for every visitor.
 */
export async function generateStaticParams() {
  const creators = getAllCreators();
  return creators.map((c) => ({ username: c.username }));
}

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const creator = getCreatorByUsername(username);
  
  if (!creator) {
    return {
      title: 'Creator Not Found | MyFans',
      description: 'The creator you are looking for does not exist or has been removed.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const plans = await getCreatorPlans(username);
  return createCreatorMetadata(creator, plans, getCurrencySymbol);
}

export default async function CreatorProfilePage({ params }: PageProps) {
  const { username } = await params;
  const creator = getCreatorByUsername(username);
  if (!creator) {
    notFound();
  }
  const viewerSubscriptionStatus = getMockViewerSubscriptionStatus(username);

  /**
   * Critical-path data fetched in parallel.
   * Plans and preview are above-the-fold; posts stream separately.
   */
  const [plans, previewContent] = await Promise.all([
    getCreatorPlans(username),
    getPreviewContent(username),
  ]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <CreatorHero
          creator={creator}
          viewerSubscriptionStatus={viewerSubscriptionStatus}
        />
        <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
          {/* Plans — critical path, rendered immediately */}
          <section className="mb-10" aria-labelledby="plans-heading">
            <h2 id="plans-heading" className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Subscription plans
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  name={plan.name}
                  price={plan.price}
                  billingPeriod={plan.billingPeriod}
                  description={plan.description}
                  features={plan.features}
                  isPopular={plan.isPopular}
                  currencySymbol={getCurrencySymbol(plan.currency)}
                  actionButton={
                    <Link
                      href={`/subscribe?creator=${username}&plan=${plan.id}`}
                      className="block w-full py-2 text-center text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                    >
                      Subscribe
                    </Link>
                  }
                />
              ))}
            </div>
          </section>

          {/* Preview — critical path, rendered immediately */}
          <section className="mb-10" aria-labelledby="preview-heading">
            <h2 id="preview-heading" className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Preview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {previewContent.map((post) => (
                <ContentCard
                  key={post.id}
                  title={post.title}
                  type={post.type}
                  thumbnailUrl={post.thumbnailUrl}
                  description={post.excerpt}
                  publishedAt={post.publishedAt}
                  viewCount={post.viewCount}
                  likeCount={post.likeCount}
                  status="published"
                  isLocked={post.isLocked}
                  creatorName={creator.displayName}
                  creatorAvatar={creator.avatarUrl}
                />
              ))}
            </div>
          </section>

          {/* Posts — below the fold; streamed independently via Suspense */}
          <section aria-labelledby="posts-heading">
            <h2 id="posts-heading" className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Posts
            </h2>
            <Suspense fallback={<PostsSkeleton />}>
              <PostsSection username={username} creator={creator} />
            </Suspense>
          </section>
        </main>
      </div>
    </ErrorBoundary>
  );
}

/** Async server component — streams independently of the critical path */
async function PostsSection({
  username,
  creator,
}: {
  username: string;
  creator: CreatorProfile;
}) {
  const posts = await getPosts(username);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post) => (
        <ContentCard
          key={post.id}
          title={post.title}
          type={post.type}
          thumbnailUrl={post.thumbnailUrl}
          description={post.excerpt}
          publishedAt={post.publishedAt}
          viewCount={post.viewCount}
          likeCount={post.likeCount}
          status="published"
          isLocked={post.isLocked}
          creatorName={creator.displayName}
          creatorAvatar={creator.avatarUrl}
        />
      ))}
    </div>
  );
}

/** Skeleton fallback rendered while PostsSection streams in */
function PostsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 h-40"
        />
      ))}
    </div>
  );
}
