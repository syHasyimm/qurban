export function QurbanLoading() {
  return (
    <div className="q-loading" role="status" aria-label="Memuat halaman">
      <div className="q-skeleton q-skeleton-heading" />
      <div className="q-skeleton q-skeleton-subtitle" />
      <div className="q-stat-grid">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="q-skeleton q-skeleton-stat" />
        ))}
      </div>
      <div className="q-skeleton q-skeleton-content" />
      <span className="sr-only">Memuat data halaman…</span>
    </div>
  );
}
