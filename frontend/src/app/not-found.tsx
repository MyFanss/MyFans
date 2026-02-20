import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-700">404</h1>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-2">Page not found</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-sm">
        The page you’re looking for doesn’t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
      >
        Go home
      </Link>
    </div>
  );
}
