export function ProgressBar({
  label,
  value,
  color = "var(--teal)",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>{label}</span>
        <span>{width.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}
