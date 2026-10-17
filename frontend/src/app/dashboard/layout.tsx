import type { Metadata } from 'next';
import DashboardNav from './DashboardNav';

export const metadata: Metadata = {
  title: 'Creator Dashboard – MyFans',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar} aria-label="Dashboard navigation">
        <p style={styles.brand}>MyFans</p>
        <p style={styles.dashLabel}>Creator Dashboard</p>
        <DashboardNav />
      </aside>
      <main style={styles.content}>{children}</main>
    </div>
  );
}

const styles = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif',
    background: '#0d0d18',
    color: '#f0f0f0',
  },
  sidebar: {
    width: '220px',
    flexShrink: 0,
    background: '#111122',
    borderRight: '1px solid #1e1e30',
    padding: '1.5rem 1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  brand: { fontSize: '1.1rem', fontWeight: 700, color: '#a78bfa', marginBottom: '0.25rem' },
  dashLabel: { fontSize: '0.7rem', color: '#555', marginBottom: '1.5rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  content: { flex: 1, overflow: 'auto' },
} as const;
