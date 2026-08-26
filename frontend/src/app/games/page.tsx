import Link from 'next/link';
import { Game, listGames } from '@/lib/api/games';

export default async function GamesPage() {
  let games: Game[] = [];
  let error: string | null = null;

  try {
    const result = await listGames({ limit: 20 });
    games = result.data;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load games';
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-primary-600">
              MyFans
            </Link>
            <div className="flex gap-4">
              <Link href="/messages" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">
                Messages
              </Link>
              <Link href="/games" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Games
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Games</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {games.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No games available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game) => (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="group block p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
                >
                  {game.imageUrl && (
                    <div className="mb-4 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
                      <img
                        src={game.imageUrl}
                        alt={game.title}
                        className="h-48 w-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600">
                    {game.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {game.description}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      game.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                      game.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}>
                      {game.status}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {game.currentPlayers}/{game.maxPlayers} players
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
