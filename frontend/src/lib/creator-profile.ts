/**
 * Creator profile data for public fan-facing page.
 * Replace with API calls when backend is ready.
 */

export interface CreatorProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  bannerUrl?: string;
  subscriberCount: number;
  subscriptionPrice: number;
  isVerified: boolean;
  categories: string[];
  location?: string;
  socialLinks: { platform: string; url: string; label?: string }[];
}

export interface CreatorPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: "month" | "year";
  description?: string;
  features?: { text: string; included: boolean }[];
  isPopular?: boolean;
}

export interface CreatorPost {
  id: string;
  title: string;
  type: "image" | "video" | "audio" | "text";
  thumbnailUrl?: string;
  excerpt?: string;
  publishedAt: string;
  isLocked: boolean;
  viewCount?: number;
  likeCount?: number;
}

/**
 * Available categories for filtering creators
 */
export const CATEGORIES = [
  "Art",
  "Music",
  "Photography",
  "Video",
  "Gaming",
  "Fitness",
  "Cooking",
  "Fashion",
  "Beauty",
  "Travel",
  "Tech",
  "Education",
  "Entertainment",
  "Sports",
  "Lifestyle",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Sort options for creator discovery
 */
export type SortOption =
  | "popular"
  | "newest"
  | "price-low"
  | "price-high"
  | "name";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "name", label: "Name: A-Z" },
];

const MOCK_CREATORS: CreatorProfile[] = [
  {
    id: "1",
    username: "jane",
    displayName: "Jane Doe",
    bio: "Digital artist and creator. Exclusive drops and behind-the-scenes for subscribers.",
    subscriberCount: 12400,
    subscriptionPrice: 9.99,
    isVerified: true,
    categories: ["Art", "Design"],
    location: "New York, USA",
    avatarUrl: "/placeholder-1.jpg",
    socialLinks: [
      {
        platform: "twitter",
        url: "https://twitter.com/janedoe",
        label: "Twitter",
      },
      {
        platform: "instagram",
        url: "https://instagram.com/janedoe",
        label: "Instagram",
      },
    ],
  },
  {
    id: "2",
    username: "alex",
    displayName: "Alex Chen",
    bio: "Photography and short films. Subscribe for early access and tutorials.",
    subscriberCount: 8300,
    subscriptionPrice: 4.99,
    isVerified: true,
    categories: ["Photography", "Video"],
    location: "Los Angeles, USA",
    avatarUrl: "/placeholder-2.jpg",
    socialLinks: [
      {
        platform: "youtube",
        url: "https://youtube.com/@alexchen",
        label: "YouTube",
      },
    ],
  },
  {
    id: "3",
    username: "maria",
    displayName: "Maria Garcia",
    bio: "Singer-songwriter sharing original music and behind-the-scenes content.",
    subscriberCount: 45200,
    subscriptionPrice: 7.99,
    isVerified: true,
    categories: ["Music", "Entertainment"],
    location: "Madrid, Spain",
    avatarUrl: "/placeholder-3.jpg",
    socialLinks: [
      {
        platform: "twitter",
        url: "https://twitter.com/mariagarcia",
        label: "Twitter",
      },
      {
        platform: "instagram",
        url: "https://instagram.com/mariagarcia",
        label: "Instagram",
      },
    ],
  },
  {
    id: "4",
    username: "james",
    displayName: "James Wilson",
    bio: "Professional fitness coach helping you reach your goals.",
    subscriberCount: 28900,
    subscriptionPrice: 12.99,
    isVerified: false,
    categories: ["Fitness", "Lifestyle"],
    location: "London, UK",
    socialLinks: [
      {
        platform: "instagram",
        url: "https://instagram.com/jamesfitness",
        label: "Instagram",
      },
    ],
  },
  {
    id: "5",
    username: "sophia",
    displayName: "Sophia Lee",
    bio: "Tech enthusiast and software developer sharing coding tutorials.",
    subscriberCount: 15600,
    subscriptionPrice: 5.99,
    isVerified: true,
    categories: ["Tech", "Education"],
    location: "San Francisco, USA",
    socialLinks: [
      {
        platform: "youtube",
        url: "https://youtube.com/sophialee",
        label: "YouTube",
      },
      {
        platform: "twitter",
        url: "https://twitter.com/sophialee",
        label: "Twitter",
      },
    ],
  },
  {
    id: "6",
    username: "david",
    displayName: "David Kim",
    bio: "Professional gamer and streamer. Join the community!",
    subscriberCount: 67800,
    subscriptionPrice: 8.99,
    isVerified: true,
    categories: ["Gaming", "Entertainment"],
    location: "Seoul, South Korea",
    socialLinks: [
      {
        platform: "twitch",
        url: "https://twitch.tv/davidkim",
        label: "Twitch",
      },
      {
        platform: "twitter",
        url: "https://twitter.com/davidkim",
        label: "Twitter",
      },
    ],
  },
  {
    id: "7",
    username: "emma",
    displayName: "Emma Brown",
    bio: "Professional chef sharing recipes and cooking tips.",
    subscriberCount: 21300,
    subscriptionPrice: 6.99,
    isVerified: true,
    categories: ["Cooking", "Lifestyle"],
    location: "Paris, France",
    socialLinks: [
      {
        platform: "instagram",
        url: "https://instagram.com/emmacooking",
        label: "Instagram",
      },
      {
        platform: "youtube",
        url: "https://youtube.com/emmacooks",
        label: "YouTube",
      },
    ],
  },
  {
    id: "8",
    username: "michael",
    displayName: "Michael Scott",
    bio: "Comedy content creator and motivational speaker.",
    subscriberCount: 89400,
    subscriptionPrice: 4.99,
    isVerified: true,
    categories: ["Entertainment", "Education"],
    location: "Scranton, USA",
    socialLinks: [
      {
        platform: "twitter",
        url: "https://twitter.com/mscott",
        label: "Twitter",
      },
    ],
  },
  {
    id: "9",
    username: "olivia",
    displayName: "Olivia Taylor",
    bio: "Fashion and lifestyle blogger sharing daily outfit inspiration.",
    subscriberCount: 34200,
    subscriptionPrice: 11.99,
    isVerified: true,
    categories: ["Fashion", "Beauty", "Lifestyle"],
    location: "Milan, Italy",
    avatarUrl: "/placeholder-1.jpg",
    socialLinks: [
      {
        platform: "instagram",
        url: "https://instagram.com/oliviataylor",
        label: "Instagram",
      },
    ],
  },
  {
    id: "10",
    username: "william",
    displayName: "William Johnson",
    bio: "Travel photographer exploring the world one photo at a time.",
    subscriberCount: 52100,
    subscriptionPrice: 9.99,
    isVerified: true,
    categories: ["Photography", "Travel"],
    location: "Tokyo, Japan",
    avatarUrl: "/placeholder-2.jpg",
    socialLinks: [
      {
        platform: "instagram",
        url: "https://instagram.com/willtravels",
        label: "Instagram",
      },
      {
        platform: "twitter",
        url: "https://twitter.com/willtravels",
        label: "Twitter",
      },
    ],
  },
  {
    id: "11",
    username: "ava",
    displayName: "Ava Martinez",
    bio: "Professional makeup artist sharing beauty tutorials and tips.",
    subscriberCount: 18700,
    subscriptionPrice: 7.99,
    isVerified: true,
    categories: ["Beauty", "Fashion"],
    location: "Los Angeles, USA",
    socialLinks: [
      {
        platform: "instagram",
        url: "https://instagram.com/avamakeup",
        label: "Instagram",
      },
      {
        platform: "youtube",
        url: "https://youtube.com/avamakeup",
        label: "YouTube",
      },
    ],
  },
  {
    id: "12",
    username: "ethan",
    displayName: "Ethan Davis",
    bio: "Sports analyst and former athlete. Breaking down the game.",
    subscriberCount: 31500,
    subscriptionPrice: 5.99,
    isVerified: false,
    categories: ["Sports", "Education"],
    location: "Chicago, USA",
    socialLinks: [
      {
        platform: "twitter",
        url: "https://twitter.com/ethansports",
        label: "Twitter",
      },
      {
        platform: "youtube",
        url: "https://youtube.com/ethansports",
        label: "YouTube",
      },
    ],
  },
];

const MOCK_CREATORS_MAP: Record<string, CreatorProfile> = MOCK_CREATORS.reduce(
  (acc, creator) => {
    acc[creator.username] = creator;
    return acc;
  },
  {} as Record<string, CreatorProfile>,
);

const MOCK_PLANS: Record<string, CreatorPlan[]> = {
  jane: [
    {
      id: "p1",
      name: "Basic",
      price: 4.99,
      currency: "USD",
      billingPeriod: "month",
      description: "Monthly drops and feed access.",
      isPopular: false,
    },
    {
      id: "p2",
      name: "Pro",
      price: 9.99,
      currency: "USD",
      billingPeriod: "month",
      description: "All Basic + exclusive livestreams.",
      isPopular: true,
    },
    {
      id: "p3",
      name: "Premium",
      price: 19.99,
      currency: "USD",
      billingPeriod: "month",
      description: "Everything + 1:1 feedback.",
      isPopular: false,
    },
  ],
  alex: [
    {
      id: "a1",
      name: "Supporter",
      price: 2.99,
      currency: "USD",
      billingPeriod: "month",
      description: "Early access to new work.",
    },
    {
      id: "a2",
      name: "Patron",
      price: 9.99,
      currency: "USD",
      billingPeriod: "month",
      description: "Full library + Discord.",
      isPopular: true,
    },
  ],
};

const MOCK_PREVIEW: CreatorPost[] = [
  {
    id: "c1",
    title: "Welcome post",
    type: "text",
    excerpt: "Thanks for visiting…",
    publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    isLocked: false,
  },
  {
    id: "c2",
    title: "Studio tour",
    type: "video",
    publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    isLocked: true,
    viewCount: 1200,
  },
  {
    id: "c3",
    title: "New artwork preview",
    type: "image",
    publishedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    isLocked: true,
    likeCount: 340,
  },
];

const MOCK_POSTS: CreatorPost[] = [
  ...MOCK_PREVIEW,
  {
    id: "c4",
    title: "Q&A highlights",
    type: "video",
    publishedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    isLocked: true,
    viewCount: 890,
  },
  {
    id: "c5",
    title: "Work in progress",
    type: "image",
    excerpt: "Sneak peek…",
    publishedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    isLocked: false,
    likeCount: 120,
  },
];

/**
 * Get all creators for discovery
 */
export function getAllCreators(): CreatorProfile[] {
  return MOCK_CREATORS;
}

/**
 * Get filtered and sorted creators for discovery page
 */
export function getCreators({
  search = "",
  categories = [],
  sort = "popular",
  page = 1,
  limit = 12,
}: {
  search?: string;
  categories?: string[];
  sort?: SortOption;
  page?: number;
  limit?: number;
}): { creators: CreatorProfile[]; total: number; hasMore: boolean } {
  let filtered = [...MOCK_CREATORS];

  // Filter by search query
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (creator) =>
        creator.displayName.toLowerCase().includes(searchLower) ||
        creator.username.toLowerCase().includes(searchLower) ||
        creator.bio.toLowerCase().includes(searchLower),
    );
  }

  // Filter by categories
  if (categories.length > 0) {
    filtered = filtered.filter((creator) =>
      categories.some((cat) =>
        creator.categories.some((c) => c.toLowerCase() === cat.toLowerCase()),
      ),
    );
  }

  // Sort creators
  switch (sort) {
    case "popular":
      filtered.sort((a, b) => b.subscriberCount - a.subscriberCount);
      break;
    case "newest":
      // For mock data, sort by id (assuming higher id = newer)
      filtered.sort((a, b) => parseInt(b.id) - parseInt(a.id));
      break;
    case "price-low":
      filtered.sort((a, b) => a.subscriptionPrice - b.subscriptionPrice);
      break;
    case "price-high":
      filtered.sort((a, b) => b.subscriptionPrice - a.subscriptionPrice);
      break;
    case "name":
      filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
      break;
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const creators = filtered.slice(start, end);

  return {
    creators,
    total,
    hasMore: end < total,
  };
}

export function getCreatorByUsername(username: string): CreatorProfile | null {
  const key = username.toLowerCase();
  return MOCK_CREATORS_MAP[key] ?? null;
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
  const map: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };
  return map[currency] ?? currency;
}
