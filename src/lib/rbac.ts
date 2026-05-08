import type { Role } from "@/types";

const ALL_ROLES: Role[] = ["kepala_kpp", "kasiwas", "ar", "teknisi"];
const OPERATIONAL_ROLES: Role[] = ["kasiwas", "ar", "teknisi"];
const DATA_WRITER_ROLES: Role[] = ["kasiwas", "teknisi"];

type ApiRule = {
  prefix: string;
  methods?: string[];
  roles: Role[];
};

const pageRules: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/dashboard", roles: ALL_ROLES },
  { prefix: "/modul1-spt", roles: ALL_ROLES },
  { prefix: "/modul2-pph21", roles: ALL_ROLES },
  { prefix: "/modul3-sosialisasi", roles: ALL_ROLES },
  { prefix: "/modul4-spt-masa", roles: ALL_ROLES },
  { prefix: "/modul5-deposit", roles: ALL_ROLES },
  { prefix: "/scoring-opd", roles: ALL_ROLES },
  { prefix: "/action-log/input", roles: OPERATIONAL_ROLES },
  { prefix: "/data-opd", roles: ALL_ROLES },
  { prefix: "/pegawai-belum-lapor", roles: OPERATIONAL_ROLES },
  { prefix: "/direktori-ar", roles: ALL_ROLES },
  { prefix: "/direktori-opd", roles: ALL_ROLES },
  { prefix: "/direktori-bendahara", roles: OPERATIONAL_ROLES },
  { prefix: "/analitik", roles: ALL_ROLES },
  { prefix: "/notifikasi", roles: ALL_ROLES },
  { prefix: "/audit-trail", roles: ["kasiwas", "teknisi"] },
  { prefix: "/import-data", roles: DATA_WRITER_ROLES },
  { prefix: "/pengguna", roles: ["kasiwas"] },
  { prefix: "/pengaturan", roles: ["kasiwas", "teknisi"] },
];

const apiRules: ApiRule[] = [
  { prefix: "/api/dashboard", roles: ALL_ROLES },
  { prefix: "/api/spt", roles: ALL_ROLES },
  { prefix: "/api/pph21", roles: ALL_ROLES },
  { prefix: "/api/spt-masa", roles: ALL_ROLES },
  { prefix: "/api/deposit", roles: ALL_ROLES },
  { prefix: "/api/scoring", roles: ALL_ROLES },
  { prefix: "/api/bendahara", roles: OPERATIONAL_ROLES },
  { prefix: "/api/sosialisasi", methods: ["GET"], roles: ALL_ROLES },
  { prefix: "/api/sosialisasi", methods: ["POST"], roles: ["kasiwas", "ar"] },
  { prefix: "/api/opd/", methods: ["GET"], roles: ALL_ROLES },
  { prefix: "/api/opd/", methods: ["PUT"], roles: ["kasiwas", "ar", "teknisi"] },
  { prefix: "/api/opd/", methods: ["DELETE"], roles: DATA_WRITER_ROLES },
  { prefix: "/api/opd", methods: ["GET"], roles: ALL_ROLES },
  { prefix: "/api/opd", methods: ["POST"], roles: DATA_WRITER_ROLES },
  { prefix: "/api/pegawai", roles: OPERATIONAL_ROLES },
  { prefix: "/api/action-log", methods: ["GET"], roles: ALL_ROLES },
  { prefix: "/api/action-log", methods: ["POST"], roles: ["kasiwas", "ar", "teknisi"] },
  { prefix: "/api/ar", methods: ["GET"], roles: ALL_ROLES },
  { prefix: "/api/ar", methods: ["POST"], roles: ["kasiwas"] },
  { prefix: "/api/users", roles: ["kasiwas"] },
  { prefix: "/api/notifications", roles: ALL_ROLES },
  { prefix: "/api/audit", roles: ["kasiwas", "teknisi"] },
  { prefix: "/api/import", roles: DATA_WRITER_ROLES },
  { prefix: "/api/export/pegawai", roles: OPERATIONAL_ROLES },
  { prefix: "/api/export/users", roles: ["kasiwas"] },
  { prefix: "/api/export", roles: ALL_ROLES },
  { prefix: "/api/seed", roles: ["kasiwas", "teknisi"] },
];

export function getAllowedPageRoles(pathname: string) {
  if (pathname === "/") return ALL_ROLES;
  const rule = pageRules.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  return rule?.roles ?? [];
}

export function canAccessPage(role: Role | undefined, pathname: string) {
  if (!role) return false;
  return getAllowedPageRoles(pathname).includes(role);
}

export function getAllowedApiRoles(pathname: string, method: string) {
  const normalizedMethod = method.toUpperCase();
  const rule = apiRules.find((item) => {
    const methodMatches = !item.methods || item.methods.includes(normalizedMethod);
    return methodMatches && (pathname === item.prefix || pathname.startsWith(item.prefix));
  });

  return rule?.roles ?? [];
}

export function canAccessApi(role: Role | undefined, pathname: string, method: string) {
  if (!role) return false;
  return getAllowedApiRoles(pathname, method).includes(role);
}

export function canCreateOpd(role: Role | undefined) {
  return role ? DATA_WRITER_ROLES.includes(role) : false;
}

export function canDeleteOpd(role: Role | undefined) {
  return canCreateOpd(role);
}

export function canEditOpd(role: Role | undefined, opdArId: number | null | undefined, userId: string | number | undefined) {
  if (!role) return false;
  if (DATA_WRITER_ROLES.includes(role)) return true;
  return role === "ar" && String(opdArId ?? "") === String(userId ?? "");
}

export function roleCanSeeNav(role: Role | undefined, href: string) {
  return canAccessPage(role, href);
}
