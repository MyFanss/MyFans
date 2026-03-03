import { Hero } from "@/components/landing";
import CreatorCardSkeleton from "@/components/ui/CreatorCardSkeleton";

export default function Home() {
  return (
    <>
      <Hero />


<CreatorCardSkeleton/>

      {/* Main content area with id for skip-to-content link */}
      <main id="main-content" className="min-h-screen">
        {/* Additional sections can be added here */}
      </main>
    </>
  );
}
