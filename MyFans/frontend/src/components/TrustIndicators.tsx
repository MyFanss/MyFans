export default function TrustIndicators() {
  return (
    <section className="w-full py-12 border-t border-zinc-200 dark:border-zinc-800" aria-label="Trust indicators">
      <div className="flex flex-wrap justify-center gap-12 text-center">
        <div>
          <p className="text-3xl font-bold">10K+</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Active Creators</p>
        </div>
        <div>
          <p className="text-3xl font-bold">$2M+</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Paid to Creators</p>
        </div>
        <div>
          <p className="text-3xl font-bold">50K+</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Subscribers</p>
        </div>
        <div>
          <p className="text-3xl font-bold">⭐ Stellar</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Blockchain Powered</p>
        </div>
      </div>
    </section>
  );
}
