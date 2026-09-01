'use client';

import Link from 'next/link';
import { useFavorites } from '@/hooks/useFavorites';

export default function FavoritesPage() {
  const { favorites, isLoading, isAuthenticated } = useFavorites();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-primary-600">
              MyFans
            </Link>
            <div className="flex gap-4">
              <Link href="/games" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">
                Games
              </Link>
              <Link href="/messages" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">
                Messages
              </Link>
              <Link href="/favorites" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Favorites
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">My Favorites</h1>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">Loading your favorites...</p>
            </div>
          ) : !isAuthenticated ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                Sign in to save and view your favorite creators
              </p>
              <Link
                href="/auth/signin"
                className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Sign In
              </Link>
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You haven't marked any creators as favorites yet
              </p>
              <Link
                href="/discover"
                className="inline-block px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                Discover Creators
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You have {favorites.length} favorite {favorites.length === 1 ? 'creator' : 'creators'}
              </p>
              <div className="space-y-2">
                {favorites.map((creatorId) => (
                  <div
                    key={creatorId}
                    className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <p className="text-gray-900 dark:text-white font-medium">{creatorId}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
