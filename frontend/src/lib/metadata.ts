/**
 * Utility functions for generating consistent metadata across the application
 */

import type { Metadata } from 'next';
import { CreatorProfile, CreatorPlan } from './creator-profile';

export interface MetadataOptions {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'profile' | 'article';
  excludeFromSearch?: boolean;
}

/**
 * Creates base metadata with consistent defaults
 */
export function createBaseMetadata(options: MetadataOptions = {}): Metadata {
  const {
    title,
    description,
    keywords = [],
    image,
    url,
    type = 'website',
    excludeFromSearch = false,
  } = options;

  return {
    title: title || 'MyFans - Decentralized Subscriptions',
    description: description || 'Connect with your favorite creators through decentralized subscription platform built on Stellar.',
    keywords: ['decentralized', 'subscriptions', 'creators', 'stellar', 'crypto', ...keywords],
    robots: excludeFromSearch ? {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    } : {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: title || 'MyFans - Decentralized Subscriptions',
      description: description || 'Connect with your favorite creators through decentralized subscription platform built on Stellar.',
      url: url || 'https://myfans.app',
      siteName: 'MyFans',
      type,
      locale: 'en_US',
      images: image ? [{
        url: image,
        width: 1200,
        height: 630,
        alt: title || 'MyFans - Decentralized Subscriptions',
      }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: title || 'MyFans - Decentralized Subscriptions',
      description: description || 'Connect with your favorite creators through decentralized subscription platform built on Stellar.',
      images: image ? [image] : [],
      site: '@myfans',
    },
    alternates: url ? {
      canonical: url,
    } : undefined,
  };
}

/**
 * Generates creator-specific metadata
 */
export function createCreatorMetadata(
  creator: CreatorProfile,
  plans: CreatorPlan[],
  getCurrencySymbol: (currency: string) => string
): Metadata {
  const title = `${creator.displayName} (@${creator.username}) | MyFans`;
  const description = creator.bio || 
    `Subscribe to ${creator.displayName} on MyFans for exclusive content. ${creator.subscriberCount.toLocaleString()} subscribers already joined.`;
  const url = `https://myfans.app/creator/${creator.username}`;

  // Get pricing information
  const lowestPrice = plans.length > 0 ? Math.min(...plans.map(p => p.price)) : null;
  const priceText = lowestPrice && plans.length > 0 
    ? `Starting from ${getCurrencySymbol(plans[0].currency)}${lowestPrice}/${plans[0].billingPeriod}`
    : '';

  // Filter out any potentially sensitive information
  const safeKeywords = [
    creator.displayName,
    creator.username,
    ...creator.categories.filter(cat => cat && typeof cat === 'string'),
    'subscription',
    'exclusive content',
    'creator',
    'fan club'
  ].filter(Boolean);

  return {
    title,
    description,
    keywords: safeKeywords.join(', '),
    authors: [{ name: creator.displayName }],
    creators: [{ name: creator.displayName, url }],
    openGraph: {
      title,
      description,
      url,
      siteName: 'MyFans',
      type: 'profile',
      locale: 'en_US',
      images: creator.avatarUrl ? [{
        url: creator.avatarUrl,
        width: 400,
        height: 400,
        alt: `${creator.displayName} profile picture`,
      }] : [],
      profile: {
        firstName: creator.displayName.split(' ')[0],
        lastName: creator.displayName.split(' ').slice(1).join(' '),
        username: creator.username,
        gender: 'unspecified',
      },
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: creator.avatarUrl ? [creator.avatarUrl] : [],
      creator: `@${creator.username}`,
      site: '@myfans',
    },
    alternates: { canonical: url },
    other: {
      'article:author': creator.displayName,
      'article:section': creator.categories.join(', '),
      'og:price:amount': lowestPrice?.toString() || '',
      'og:price:currency': plans[0]?.currency || '',
      'twitter:label1': 'Subscribers',
      'twitter:data1': creator.subscriberCount.toLocaleString(),
      'twitter:label2': priceText ? 'Starting from' : '',
      'twitter:data2': priceText || '',
    },
  };
}

/**
 * Validates that metadata doesn't contain sensitive information
 */
export function validateMetadataSafety(metadata: Record<string, any>): boolean {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /private\s+key/i,
    /email/i,
    /phone/i,
    /address/i,
    /ssn/i,
    /credit\s+card/i,
    /bank\s+account/i,
  ];

  const metadataString = JSON.stringify(metadata).toLowerCase();
  
  return !sensitivePatterns.some(pattern => pattern.test(metadataString));
}

/**
 * Sanitizes metadata by removing potentially sensitive fields
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    'email',
    'phone',
    'address',
    'privateKey',
    'secret',
    'token',
    'password',
    'ssn',
    'creditCard',
    'bankAccount',
  ];

  const sanitized = { ...metadata };
  
  const removeSensitiveFields = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(removeSensitiveFields);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
        continue; // Skip sensitive fields
      }
      result[key] = removeSensitiveFields(value);
    }
    return result;
  };

  return removeSensitiveFields(sanitized);
}
