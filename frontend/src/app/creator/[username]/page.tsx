import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  getCreatorByUsername,
  getCreatorPlans,
  getPreviewContent,
  getPosts,
  getCurrencySymbol,
  type CreatorProfile,
} from '@/lib/creator-profile';
import { PlanCard } from '@/components/cards';
import { ContentCard } from '@/components/cards';

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const creator = getCreatorByUsername(username);
  if (!creator) {
    return { title: 'Creator Not Found' };
  }
  const title = `${creator.displayName} (@${creator.username}) | MyFans`;
  const description = creator.bio || `Subscribe to ${creator.displayName} on MyFans`;
  const url = `https://myfans.app/creator/${creator.username}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'MyFans',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: { canonical: url },
  };
}

export default async function CreatorProfilePage({ params }: PageProps) {
  const { username } = await params;
  const creator = getCreatorByUsername(username);
  if (!creator) {
    notFound();
  }

  const plans = getCreatorPlans(username);
  const previewContent = getPreviewContent(username);
  const posts = getPosts(username);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <CreatorHero creator={creator} />
      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
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

        <section aria-labelledby="posts-heading">
          <h2 id="posts-heading" className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Posts
          </h2>
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
        </section>
      </main>
    </div>
  );
}

function CreatorHero({ creator }: { creator: CreatorProfile }) {
  return (
    <header className="relative">
      <div className="h-40 sm:h-52 bg-gradient-to-br from-primary-500 to-primary-800 dark:from-primary-700 dark:to-primary-900" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20 relative">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
            {creator.avatarUrl ? (
              <Image src={creator.avatarUrl} alt="" width={128} height={128} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl sm:text-4xl font-bold text-gray-500 dark:text-gray-400">
                {creator.displayName.charAt(0)}
              </span>
            )}
          </div>
          <div className="pb-1 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {creator.displayName}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">@{creator.username}</p>
            <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">
              {creator.subscriberCount.toLocaleString()} subscribers
            </p>
            {creator.bio && (
              <p className="mt-2 text-gray-600 dark:text-gray-300 max-w-2xl">{creator.bio}</p>
            )}
            {creator.socialLinks.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-3" aria-label="Social links">
                {creator.socialLinks.map((link) => (
                  <li key={link.platform}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {link.label ?? link.platform}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
