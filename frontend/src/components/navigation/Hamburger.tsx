'use client';

export default function Hamburger({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 50, padding: '0.5rem', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} className="lg:hidden" aria-label="Toggle menu">
      <div style={{ width: '1.5rem', height: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <span style={{ display: 'block', height: '2px', width: '100%', backgroundColor: '#171717', transition: 'transform 0.3s', transform: isOpen ? 'rotate(45deg) translateY(8px)' : 'none' }} />
        <span style={{ display: 'block', height: '2px', width: '100%', backgroundColor: '#171717', transition: 'opacity 0.3s', opacity: isOpen ? 0 : 1 }} />
        <span style={{ display: 'block', height: '2px', width: '100%', backgroundColor: '#171717', transition: 'transform 0.3s', transform: isOpen ? 'rotate(-45deg) translateY(-8px)' : 'none' }} />
      </div>
    </button>
  );
}
