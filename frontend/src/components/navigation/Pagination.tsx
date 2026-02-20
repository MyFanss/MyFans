'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} style={{ padding: '0.5rem 1rem', minHeight: '44px', minWidth: '44px', border: '1px solid #d1d5db', borderRadius: '0.5rem', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
        ←
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
        <button key={page} onClick={() => onPageChange(page)} style={{ padding: '0.5rem 1rem', minHeight: '44px', minWidth: '44px', borderRadius: '0.5rem', backgroundColor: page === currentPage ? '#0ea5e9' : 'transparent', color: page === currentPage ? 'white' : 'inherit', border: page === currentPage ? 'none' : '1px solid #d1d5db' }}>
          {page}
        </button>
      ))}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: '0.5rem 1rem', minHeight: '44px', minWidth: '44px', border: '1px solid #d1d5db', borderRadius: '0.5rem', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
        →
      </button>
    </div>
  );
}
