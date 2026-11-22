import Link from 'next/link';

/**
 * Home page — `/`.
 *
 * `frontend/src/app` is the only app directory Next.js serves routes from
 * (see frontend/docs/CSP.md and the removed `frontend/app` duplicate tree,
 * #2209). Logged-out visitors land here and are pointed at the public
 * creator discovery page or sign-in.
 */
export default function HomePage() {
  return (
    <main className="home-page">
      <h1 className="home-page__title">MyFans</h1>
      <p className="home-page__tagline">
        Decentralized content subscriptions, powered by Stellar.
      </p>
      <nav className="home-page__actions" aria-label="Primary">
        <Link href="/discover" className="home-page__cta">
          Discover creators
        </Link>
        <Link href="/auth/sign-in" className="home-page__secondary">
          Sign in
        </Link>
      </nav>
    </main>
  );
}
