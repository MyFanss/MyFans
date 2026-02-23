import { Hero } from "@/components/landing";

export default function Home() {
  return (
    <>
      <Hero />

      {/* Main content area with id for skip-to-content link */}
      <main id="main-content" className="min-h-screen">
        {/* Additional sections can be added here */}
      </main>
    </>
  );
}
