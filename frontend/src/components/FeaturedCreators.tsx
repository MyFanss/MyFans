'use client';

const creators = [
  { name: 'Alex Chen', category: 'Photography', subscribers: '12.5K', color: '#3b82f6' },
  { name: 'Maria Garcia', category: 'Art & Design', subscribers: '8.3K', color: '#ec4899' },
  { name: 'James Wilson', category: 'Music', subscribers: '15.2K', color: '#8b5cf6' },
];

export default function FeaturedCreators() {
  return (
    <section className="w-full py-16 bg-zinc-50 dark:bg-zinc-900" aria-labelledby="creators-heading">
      <h2 id="creators-heading" className="text-3xl font-bold text-center mb-12">Featured Creators</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-6">
        {creators.map((c) => (
          <article key={c.name} className="bg-white dark:bg-black rounded-lg p-6 text-center">
            <div 
              className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: c.color }}
              role="img"
              aria-label={`${c.name}'s avatar`}
            >
              {c.name.split(' ').map(n => n[0]).join('')}
            </div>
            <h3 className="text-xl font-semibold mb-1">{c.name}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{c.category}</p>
            <p className="text-sm font-medium">{c.subscribers} subscribers</p>
          </article>
        ))}
      </div>
    </section>
  );
}
