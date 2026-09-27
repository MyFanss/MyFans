/**
 * Resolves the backend API base URL from environment variables.
 *
 * Priority:
 *   1. NEXT_PUBLIC_API_URL (set in .env.local or CI)
 *   2. Falls back to http://localhost:3001 for local development.
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url && url.trim().length > 0) {
    return url.trim().replace(/\/$/, '');
  }
  return 'http://localhost:3001';
}
