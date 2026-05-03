export default function Loading() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton" style={{ width: 260, minHeight: 28, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: 420, minHeight: 16 }} />
        </div>
      </div>
      <section className="kpi-grid">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </section>
      <div className="card">
        <div className="card-body">
          <div className="skeleton" style={{ minHeight: 320 }} />
        </div>
      </div>
    </div>
  );
}
