import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Handsoff</h1>
      <p>Frontend application shell.</p>
      <nav>
        <ul>
          <li>
            <Link href="/dashboard">Dashboard</Link>
          </li>
          <li>
            <Link href="/demo">Demo</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
