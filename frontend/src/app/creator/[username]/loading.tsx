/**
 * Streaming skeleton shown by Next.js App Router while the creator
 * profile page is being generated server-side.
 */
export default function CreatorPageLoading() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 animate-pulse">
            {/* Hero skeleton */}
            <header className="relative">
                <div className="h-40 sm:h-52 bg-gray-300 dark:bg-gray-700" />
                <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20 relative">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                        <div className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-400 dark:bg-gray-600 border-4 border-white dark:border-gray-900" />
                        <div className="pb-1 flex-1 space-y-3 py-4">
                            <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-48" />
                            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32" />
                            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-56" />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
                {/* Plans skeleton */}
                <section className="mb-10">
                    <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-40 mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                                <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-24" />
                                <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-16" />
                                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full" />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Preview skeleton */}
                <section className="mb-10">
                    <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-28 mb-4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 h-40" />
                        ))}
                    </div>
                </section>

                {/* Posts skeleton */}
                <section>
                    <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 h-40" />
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
