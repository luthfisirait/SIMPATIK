import Link from "next/link";

type PaginationProps = {
  page: number;
  pages: number;
  basePath: string;
  query?: Record<string, string | number | undefined>;
};

function hrefFor(basePath: string, page: number, query: PaginationProps["query"]) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      params.set(key, String(value));
    }
  });
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({ page, pages, basePath, query }: PaginationProps) {
  const safePage = Math.min(Math.max(page, 1), pages);
  const nearby = Array.from(new Set([1, safePage - 1, safePage, safePage + 1, pages])).filter(
    (item) => item >= 1 && item <= pages,
  );

  return (
    <div className="pagination">
      <Link className="page-btn" href={hrefFor(basePath, Math.max(1, safePage - 1), query)} aria-label="Halaman sebelumnya">
        {"<"}
      </Link>
      {nearby.map((item) => (
        <Link key={item} className={item === safePage ? "page-btn active" : "page-btn"} href={hrefFor(basePath, item, query)}>
          {item}
        </Link>
      ))}
      <Link className="page-btn" href={hrefFor(basePath, Math.min(pages, safePage + 1), query)} aria-label="Halaman berikutnya">
        {">"}
      </Link>
    </div>
  );
}
