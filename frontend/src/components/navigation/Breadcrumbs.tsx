'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', marginBottom: '1rem' }} aria-label="Breadcrumb">
      <Link href="/" style={{ color: '#0ea5e9', minHeight: '44px', display: 'flex', alignItems: 'center' }}>Home</Link>
      {segments.map((segment, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const label = segment.charAt(0).toUpperCase() + segment.slice(1);
        return (
          <span key={href} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#9ca3af' }}>/</span>
            {i === segments.length - 1 ? (
              <span style={{ color: '#171717', minHeight: '44px', display: 'flex', alignItems: 'center' }}>{label}</span>
            ) : (
              <Link href={href} style={{ color: '#0ea5e9', minHeight: '44px', display: 'flex', alignItems: 'center' }}>{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
