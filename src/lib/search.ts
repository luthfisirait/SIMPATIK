export type PageSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(params: PageSearchParams | undefined, key: string, fallback = "") {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export function numericParam(params: PageSearchParams | undefined, key: string, fallback = 1) {
  const value = Number(firstParam(params, key, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function keepQuery(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== "" && value !== "all"));
}

export function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      query.set(key, String(value));
    }
  });
  return query.toString();
}
