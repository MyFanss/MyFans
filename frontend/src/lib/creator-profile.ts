/**
 * Creator profile data for public fan-facing page.
 * Replace with API calls when backend is ready.
 */

export interface CreatorProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  bannerUrl?: string;
  subscriberCount: number;
  socialLinks: { platform: string; url: string; label?: string }[];
}

export interface CreatorPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: 'month' | 'year';
  description?: string;
  features?: { text: string; included: boolean }[];
  isPopular?: boolean;
}

export interface CreatorPost {
  id: string;
  title: string;
  type: 'image' | 'video' | 'audio' | 'text';
  thumbnailUrl?: string;
  excerpt?: string;
  publishedAt: string;
  isLocked: boolean;
  viewCount?: number;
  likeCount?: number;
}

const MOCK_CREATORS: Record<string, CreatorProfile> = {
  jane: {
    username: 'jane',
    displayName: 'Jane Doe',
    bio: 'Digital artist and creator. Exclusive drops and behind-the-scenes for subscribers.',
    subscriberCount: 12400,
    socialLinks: [
      { platform: 'twitter', url: 'https://twitter.com/janedoe', label: 'Twitter' },
      { platform: 'instagram', url: 'https://instagram.com/janedoe', label: 'Instagram' },
    ],
  },
  alex: {
    username: 'alex',
    displayName: 'Alex Chen',
    bio: 'Photography and short films. Subscribe for early access and tutorials.',
    subscriberCount: 8300,
    socialLinks: [
      { platform: 'youtube', url: 'https://youtube.com/@alexchen', label: 'YouTube' },
    ],
  },
};

const MOCK_PLANS: Record<string, CreatorPlan[]> = {
  jane: [
    { id: 'p1', name: 'Basic', price: 4.99, currency: 'USD', billingPeriod: 'month', description: 'Monthly drops and feed access.', isPopular: false },
    { id: 'p2', name: 'Pro', price: 9.99, currency: 'USD', billingPeriod: 'month', description: 'All Basic + exclusive livestreams.', isPopular: true },
    { id: 'p3', name: 'Premium', price: 19.99, currency: 'USD', billingPeriod: 'month', description: 'Everything + 1:1 feedback.', isPopular: false },
  ],
  alex: [
    { id: 'a1', name: 'Supporter', price: 2.99, currency: 'USD', billingPeriod: 'month', description: 'Early access to new work.' },
    { id: 'a2', name: 'Patron', price: 9.99, currency: 'USD', billingPeriod: 'month', description: 'Full library + Discord.', isPopular: true },
  ],
};

const MOCK_PREVIEW: CreatorPost[] = [
  { id: 'c1', title: 'Welcome post', type: 'text', excerpt: 'Thanks for visiting…', publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(), isLocked: false },
  { id: 'c2', title: 'Studio tour', type: 'video', publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(), isLocked: true, viewCount: 1200 },
  { id: 'c3', title: 'New artwork preview', type: 'image', publishedAt: new Date(Date.now() - 86400000 * 7).toISOString(), isLocked: true, likeCount: 340 },
];

const MOCK_POSTS: CreatorPost[] = [
  ...MOCK_PREVIEW,
  { id: 'c4', title: 'Q&A highlights', type: 'video', publishedAt: new Date(Date.now() - 86400000 * 10).toISOString(), isLocked: true, viewCount: 890 },
  { id: 'c5', title: 'Work in progress', type: 'image', excerpt: 'Sneak peek…', publishedAt: new Date(Date.now() - 86400000 * 14).toISOString(), isLocked: false, likeCount: 120 },
];

export function getCreatorByUsername(username: string): CreatorProfile | null {
  const key = username.toLowerCase();
  return MOCK_CREATORS[key] ?? null;
}

export function getCreatorPlans(username: string): CreatorPlan[] {
  const key = username.toLowerCase();
  return MOCK_PLANS[key] ?? MOCK_PLANS.jane;
}

export function getPreviewContent(_username: string): CreatorPost[] {
  return MOCK_PREVIEW;
}

export function getPosts(_username: string): CreatorPost[] {
  return MOCK_POSTS;
}

export function getCurrencySymbol(currency: string): string {
  const map: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
  return map[currency] ?? currency;
}
