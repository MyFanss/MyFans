/**
 * Tests for metadata generation functionality
 */

import { getCreatorByUsername, getCreatorPlans, getCurrencySymbol } from '../creator-profile';
import { generateMetadata } from '../../app/creator/[username]/page';
import { 
  createBaseMetadata, 
  createCreatorMetadata, 
  validateMetadataSafety, 
  sanitizeMetadata 
} from '../metadata';

// Mock the creator profile module
jest.mock('../creator-profile', () => ({
  getCreatorByUsername: jest.fn(),
  getCreatorPlans: jest.fn(),
  getCurrencySymbol: jest.fn(),
}));

describe('Metadata Generation', () => {
  const mockCreator = {
    id: '1',
    username: 'jane',
    displayName: 'Jane Doe',
    bio: 'Digital artist and creator. Exclusive drops and behind-the-scenes for subscribers.',
    subscriberCount: 12400,
    subscriptionPrice: 9.99,
    isVerified: true,
    categories: ['Art', 'Design'],
    location: 'New York, USA',
    avatarUrl: 'https://example.com/avatar.jpg',
    socialLinks: [
      {
        platform: 'twitter',
        url: 'https://twitter.com/janedoe',
        label: 'Twitter',
      },
    ],
  };

  const mockPlans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 9.99,
      currency: 'USD',
      billingPeriod: 'month' as const,
      description: 'Basic subscription',
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 19.99,
      currency: 'USD',
      billingPeriod: 'month' as const,
      description: 'Premium subscription',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrencySymbol as jest.Mock).mockReturnValue('$');
  });

  describe('generateMetadata (page function)', () => {
    it('generates correct metadata for existing creator', async () => {
      (getCreatorByUsername as jest.Mock).mockReturnValue(mockCreator);
      (getCreatorPlans as jest.Mock).mockReturnValue(mockPlans);

      const params = Promise.resolve({ username: 'jane' });
      const metadata = await generateMetadata({ params });

      expect(metadata.title).toBe('Jane Doe (@jane) | MyFans');
      expect(metadata.description).toContain('Digital artist and creator');
      expect(metadata.description).toContain('12,400 subscribers');
      expect(metadata.keywords).toContain('Jane Doe');
      expect(metadata.keywords).toContain('jane');
      expect(metadata.keywords).toContain('Art');
      expect(metadata.keywords).toContain('Design');

      // Open Graph metadata
      expect(metadata.openGraph?.title).toBe('Jane Doe (@jane) | MyFans');
      expect(metadata.openGraph?.type).toBe('profile');
      expect(metadata.openGraph?.url).toBe('https://myfans.app/creator/jane');
      expect(metadata.openGraph?.images).toHaveLength(1);
      expect(metadata.openGraph?.images?.[0].url).toBe('https://example.com/avatar.jpg');
      expect(metadata.openGraph?.profile?.username).toBe('jane');

      // Twitter metadata
      expect(metadata.twitter?.card).toBe('summary_large_image');
      expect(metadata.twitter?.creator).toBe('@jane');
      expect(metadata.twitter?.site).toBe('@myfans');

      // Custom metadata
      expect(metadata.other?.['twitter:label1']).toBe('Subscribers');
      expect(metadata.other?.['twitter:data1']).toBe('12,400');
      expect(metadata.other?.['twitter:label2']).toBe('Starting from');
      expect(metadata.other?.['twitter:data2']).toBe('Starting from $9.99/month');
    });

    it('handles missing creator gracefully', async () => {
      (getCreatorByUsername as jest.Mock).mockReturnValue(null);

      const params = Promise.resolve({ username: 'nonexistent' });
      const metadata = await generateMetadata({ params });

      expect(metadata.title).toBe('Creator Not Found | MyFans');
      expect(metadata.description).toBe('The creator you are looking for does not exist or has been removed.');
      expect(metadata.robots?.index).toBe(false);
      expect(metadata.robots?.follow).toBe(false);
    });
  });

  describe('createBaseMetadata', () => {
    it('creates metadata with default values', () => {
      const metadata = createBaseMetadata();

      expect(metadata.title).toBe('MyFans - Decentralized Subscriptions');
      expect(metadata.description).toContain('Connect with your favorite creators');
      expect(metadata.keywords).toContain('decentralized');
      expect(metadata.keywords).toContain('subscriptions');
      expect(metadata.openGraph?.type).toBe('website');
      expect(metadata.twitter?.card).toBe('summary_large_image');
    });

    it('creates metadata with custom values', () => {
      const metadata = createBaseMetadata({
        title: 'Custom Title',
        description: 'Custom description',
        keywords: ['custom', 'keywords'],
        url: 'https://example.com',
        type: 'article',
      });

      expect(metadata.title).toBe('Custom Title');
      expect(metadata.description).toBe('Custom description');
      expect(metadata.keywords).toContain('custom');
      expect(metadata.keywords).toContain('keywords');
      expect(metadata.openGraph?.url).toBe('https://example.com');
      expect(metadata.openGraph?.type).toBe('article');
      expect(metadata.alternates?.canonical).toBe('https://example.com');
    });

    it('handles exclude from search option', () => {
      const metadata = createBaseMetadata({ excludeFromSearch: true });

      expect(metadata.robots?.index).toBe(false);
      expect(metadata.robots?.follow).toBe(false);
      expect(metadata.robots?.googleBot?.index).toBe(false);
      expect(metadata.robots?.googleBot?.follow).toBe(false);
    });
  });

  describe('createCreatorMetadata', () => {
    it('creates comprehensive creator metadata', () => {
      const metadata = createCreatorMetadata(mockCreator, mockPlans, getCurrencySymbol);

      expect(metadata.title).toBe('Jane Doe (@jane) | MyFans');
      expect(metadata.description).toContain('Digital artist and creator');
      expect(metadata.description).toContain('12,400 subscribers');
      expect(metadata.authors).toHaveLength(1);
      expect(metadata.authors?.[0].name).toBe('Jane Doe');
      expect(metadata.creators).toHaveLength(1);
      expect(metadata.creators?.[0].name).toBe('Jane Doe');
    });

    it('handles creator without bio', () => {
      const creatorWithoutBio = { ...mockCreator, bio: '' };
      const metadata = createCreatorMetadata(creatorWithoutBio, mockPlans, getCurrencySymbol);

      expect(metadata.description).toContain('Subscribe to Jane Doe on MyFans for exclusive content');
      expect(metadata.description).toContain('12,400 subscribers');
    });

    it('handles creator without avatar', () => {
      const creatorWithoutAvatar = { ...mockCreator, avatarUrl: undefined };
      const metadata = createCreatorMetadata(creatorWithoutAvatar, mockPlans, getCurrencySymbol);

      expect(metadata.openGraph?.images).toHaveLength(0);
      expect(metadata.twitter?.images).toHaveLength(0);
    });

    it('handles creator without plans', () => {
      const metadata = createCreatorMetadata(mockCreator, [], getCurrencySymbol);

      expect(metadata.other?.['twitter:label2']).toBe('');
      expect(metadata.other?.['twitter:data2']).toBe('');
      expect(metadata.other?.['og:price:amount']).toBe('');
      expect(metadata.other?.['og:price:currency']).toBe('');
    });

    it('splits creator name correctly', () => {
      const metadata = createCreatorMetadata(mockCreator, mockPlans, getCurrencySymbol);

      expect(metadata.openGraph?.profile?.firstName).toBe('Jane');
      expect(metadata.openGraph?.profile?.lastName).toBe('Doe');
    });

    it('handles single name creator', () => {
      const singleNameCreator = { ...mockCreator, displayName: 'Madonna' };
      const metadata = createCreatorMetadata(singleNameCreator, mockPlans, getCurrencySymbol);

      expect(metadata.openGraph?.profile?.firstName).toBe('Madonna');
      expect(metadata.openGraph?.profile?.lastName).toBe('');
    });

    it('filters out invalid categories', () => {
      const creatorWithInvalidCategories = {
        ...mockCreator,
        categories: ['Art', '', null, undefined, 'Music', false, true, 123]
      };
      const metadata = createCreatorMetadata(creatorWithInvalidCategories, mockPlans, getCurrencySymbol);

      expect(metadata.keywords).toContain('Art');
      expect(metadata.keywords).toContain('Music');
      expect(metadata.keywords).not.toContain('');
      expect(metadata.keywords).not.toContain('null');
      expect(metadata.keywords).not.toContain('true');
    });
  });

  describe('validateMetadataSafety', () => {
    it('validates safe metadata', () => {
      const safeMetadata = {
        title: 'Safe Title',
        description: 'Safe description',
        creator: 'John Doe',
      };

      expect(validateMetadataSafety(safeMetadata)).toBe(true);
    });

    it('detects sensitive information', () => {
      const unsafeMetadata = {
        title: 'Title',
        email: 'john@example.com',
        password: 'secret123',
      };

      expect(validateMetadataSafety(unsafeMetadata)).toBe(false);
    });

    it('detects sensitive information in nested objects', () => {
      const unsafeMetadata = {
        title: 'Title',
        user: {
          name: 'John',
          privateKey: 'secret_key_123',
        },
      };

      expect(validateMetadataSafety(unsafeMetadata)).toBe(false);
    });

    it('detects sensitive information in arrays', () => {
      const unsafeMetadata = {
        title: 'Title',
        data: [
          { name: 'item1' },
          { token: 'secret_token' },
        ],
      };

      expect(validateMetadataSafety(unsafeMetadata)).toBe(false);
    });
  });

  describe('sanitizeMetadata', () => {
    it('keeps safe metadata unchanged', () => {
      const safeMetadata = {
        title: 'Safe Title',
        description: 'Safe description',
        creator: 'John Doe',
      };

      const sanitized = sanitizeMetadata(safeMetadata);
      expect(sanitized).toEqual(safeMetadata);
    });

    it('removes sensitive fields', () => {
      const unsafeMetadata = {
        title: 'Title',
        description: 'Description',
        email: 'john@example.com',
        password: 'secret123',
        phoneNumber: '123-456-7890',
      };

      const sanitized = sanitizeMetadata(unsafeMetadata);
      expect(sanitized).toEqual({
        title: 'Title',
        description: 'Description',
      });
    });

    it('removes sensitive fields from nested objects', () => {
      const unsafeMetadata = {
        title: 'Title',
        user: {
          name: 'John',
          email: 'john@example.com',
          address: '123 Main St',
        },
        settings: {
          theme: 'dark',
          secretToken: 'token123',
        },
      };

      const sanitized = sanitizeMetadata(unsafeMetadata);
      expect(sanitized).toEqual({
        title: 'Title',
        user: {
          name: 'John',
        },
        settings: {
          theme: 'dark',
        },
      });
    });

    it('handles arrays correctly', () => {
      const unsafeMetadata = {
        title: 'Title',
        users: [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', phone: '123-456-7890' },
        ],
      };

      const sanitized = sanitizeMetadata(unsafeMetadata);
      expect(sanitized).toEqual({
        title: 'Title',
        users: [
          { name: 'John' },
          { name: 'Jane' },
        ],
      });
    });
  });
});
