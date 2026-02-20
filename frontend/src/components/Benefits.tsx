import { ReactNode } from 'react';

const benefits = [
  { icon: '⚡', title: 'Instant Payments', desc: 'Get paid in 3-5 seconds with Stellar' },
  { icon: '💰', title: 'Low Fees', desc: 'Keep more with minimal transaction costs' },
  { icon: '🌍', title: 'Multi-Currency', desc: 'Accept XLM, USDC, and other assets' },
  { icon: '🔒', title: 'Decentralized', desc: 'You own your content and earnings' },
];

export default function Benefits() {
  return (
    <section className="w-full py-16" aria-labelledby="benefits-heading">
      <h2 id="benefits-heading" className="text-3xl font-bold text-center mb-12">Why MyFans?</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {benefits.map((b) => (
          <div key={b.title} className="text-center">
            <div className="text-4xl mb-4" role="img" aria-label={b.title}>{b.icon}</div>
            <h3 className="text-xl font-semibold mb-2">{b.title}</h3>
            <p className="text-zinc-600 dark:text-zinc-400">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
