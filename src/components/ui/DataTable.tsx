export function DataTable({
  headers,
  children,
  minWidth = 760,
}: {
  headers: string[];
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table" style={{ minWidth }}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
