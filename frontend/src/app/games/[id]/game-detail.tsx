'use client';

import { useState } from 'react';
import { joinGame, startGame, type Game } from '@/lib/api/games';
import { useAuth } from '@/hooks/useAuth';
import { getCsrfToken } from '@/lib/csrf';

interface GameDetailProps {
  game: Game;
}

export function GameDetail({ game }: GameDetailProps) {
  const { isAuthenticated, isLoading, sessionData } = useAuth();
  const userId = sessionData?.id ?? null;
  const [isJoining, setIsJoining] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const canJoin = !isJoining && !isJoined && isAuthenticated && game.currentPlayers < game.maxPlayers && game.status === 'ACTIVE';
  const isHost = isAuthenticated && userId && game.hostUserId === userId;
  const canStart = !isStarting && !gameStarted && isHost && game.status === 'PENDING' && game.currentPlayers >= 2;

  const handleJoin = async () => {
    if (!isAuthenticated) {
      setError('Please log in to join this game');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const csrfToken = await getCsrfToken();
      await joinGame(game.id, csrfToken);
      setIsJoined(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join game';
      if (errorMessage === 'Unauthorized') {
        setError('You must be signed in to join games. Please sign in and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleStart = async () => {
    if (!isHost) {
      setError('Only the host can start the game');
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    setIsStarting(true);
    setError(null);

    try {
      const csrfToken = await getCsrfToken();
      await startGame(game.id, { idempotencyKey }, csrfToken);
      setGameStarted(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start game';
      setError(errorMessage);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div>
      {game.imageUrl && (
        <div className="mb-6 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
          <img
            src={game.imageUrl}
            alt={game.title}
            className="h-96 w-full object-cover"
          />
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {game.title}
            </h1>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              game.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
              game.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
              'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
            }`}>
              {game.status}
            </span>
          </div>
        </div>

        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
          {game.description}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Players</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {game.currentPlayers}/{game.maxPlayers}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Availability</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {game.maxPlayers - game.currentPlayers} spots
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {isJoined && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200">Successfully joined the game!</p>
        </div>
      )}

      {gameStarted && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200">Game started successfully!</p>
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? (
          <button
            disabled
            className="w-full py-3 px-4 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium cursor-not-allowed"
          >
            Loading...
          </button>
        ) : !isAuthenticated ? (
          <button
            disabled
            className="w-full py-3 px-4 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium cursor-not-allowed"
          >
            Log in to join
          </button>
        ) : isJoined ? (
          <button
            disabled
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium cursor-not-allowed"
          >
            Joined ✓
          </button>
        ) : game.status !== 'ACTIVE' ? (
          <button
            disabled
            className="w-full py-3 px-4 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium cursor-not-allowed"
          >
            Game {game.status}
          </button>
        ) : game.currentPlayers >= game.maxPlayers ? (
          <button
            disabled
            className="w-full py-3 px-4 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium cursor-not-allowed"
          >
            Game Full
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={isJoining || !canJoin}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isJoining ? 'Joining...' : 'Join Game'}
          </button>
        )}

        {isHost && !gameStarted && (
          isLoading ? (
            <button disabled className="w-full py-3 px-4 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium cursor-not-allowed">
              Loading...
            </button>
          ) : game.currentPlayers < 2 ? (
            <button
              disabled
              className="w-full py-3 px-4 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium cursor-not-allowed"
            >
              Need at least 2 players to start
            </button>
          ) : game.status !== 'PENDING' ? (
            <button
              disabled
              className="w-full py-3 px-4 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium cursor-not-allowed"
            >
              Game {game.status}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={isStarting || !canStart}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isStarting ? 'Starting...' : 'Start Game'}
            </button>
          )
        )}
      </div>
    </div>
  );
}
