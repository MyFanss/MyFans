import Link from 'next/link';

export default function FavoritesPage() {
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

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-blue-800 dark:text-blue-200">
              Your favorite creators are loaded from the backend API using the <code className="bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">useFavorites()</code> hook.
            </p>
            <p className="text-blue-800 dark:text-blue-200 mt-2">
              Use the <code className="bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">FavoriteButton</code> component on creator profiles to add/remove favorites.
            </p>
          </div>

          <div className="mt-8">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Your favorite creators will appear here when you mark them with ⭐
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
