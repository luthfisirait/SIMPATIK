import crypto from "crypto";

import { getDb } from "@/lib/db";

import type Database from "better-sqlite3";

const DEFAULT_SPREADSHEET_ID = "14AGHI2591Bai0HAsz8MGjIW-qLs6anJ_uVfm9DKdTgQ";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const TABLES = [
  "wilayah",
  "users",
  "opd",
  "spt_monitoring",
  "pph21_monitoring",
  "spt_masa_monitoring",
  "deposit_monitoring",
  "scoring_opd",
  "sosialisasi",
  "pegawai",
  "action_log",
  "notifications",
  "audit_log",
  "settings",
] as const;

const DELETE_ORDER = [
  "audit_log",
  "notifications",
  "action_log",
  "pegawai",
  "sosialisasi",
  "scoring_opd",
  "deposit_monitoring",
  "spt_masa_monitoring",
  "pph21_monitoring",
  "spt_monitoring",
  "opd",
  "users",
  "wilayah",
  "settings",
] as const;

const INSERT_ORDER = [
  "wilayah",
  "users",
  "opd",
  "spt_monitoring",
  "pph21_monitoring",
  "spt_masa_monitoring",
  "deposit_monitoring",
  "scoring_opd",
  "sosialisasi",
  "pegawai",
  "action_log",
  "notifications",
  "audit_log",
  "settings",
] as const;

type TableName = (typeof TABLES)[number];
type SheetValues = Map<TableName, unknown[][]>;

let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let tokenCache: { token: string; expiresAt: number } | null = null;
const isVercel = process.env.VERCEL === "1";

function config() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_DB_ID ?? DEFAULT_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) return null;
  return { clientEmail, privateKey, spreadsheetId };
}

export function isGoogleSheetsStoreConfigured() {
  return Boolean(config());
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function accessToken() {
  const cfg = config();
  if (!cfg) throw new Error("Google Sheets belum dikonfigurasi.");
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: cfg.clientEmail,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(cfg.privateKey);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? "Gagal mengambil token Google Sheets.");
  }

  tokenCache = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

async function sheetsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = config();
  if (!cfg) throw new Error("Google Sheets belum dikonfigurasi.");
  const token = await accessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}${path}`;
  const response = await fetch(url, {
    cache: init?.cache ?? "no-store",
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Gagal mengakses Google Sheets.");
  }
  return body;
}

function quoteSheet(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function tableColumns(database: Database.Database, table: TableName) {
  return (
    database.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>
  ).map((column) => column.name);
}

async function ensureSheets() {
  if (!isGoogleSheetsStoreConfigured()) return;
  const spreadsheet = await sheetsFetch<{ sheets?: Array<{ properties: { title: string } }> }>(
    "?fields=sheets.properties.title",
  );
  const existing = new Set(spreadsheet.sheets?.map((sheet) => sheet.properties.title) ?? []);
  const requests = TABLES.filter((table) => !existing.has(table)).map((table) => ({
    addSheet: { properties: { title: table } },
  }));
  if (requests.length > 0) {
    await sheetsFetch(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
  }
}

async function readSheets(): Promise<SheetValues> {
  await ensureSheets();
  const query = TABLES.map((table) => `ranges=${encodeURIComponent(`${quoteSheet(table)}!A:ZZ`)}`).join("&");
  const response = await sheetsFetch<{ valueRanges?: Array<{ values?: unknown[][] }> }>(
    `/values:batchGet?majorDimension=ROWS&${query}`,
  );
  return new Map(TABLES.map((table, index) => [table, response.valueRanges?.[index]?.values ?? []]));
}

function sheetHasRows(values: SheetValues) {
  return [...values.values()].some((rows) => rows.length > 1);
}

function restoreTable(database: Database.Database, table: TableName, values: unknown[][]) {
  if (values.length <= 1) return;
  const dbColumns = new Set(tableColumns(database, table));
  const columns = values[0].map((value) => String(value)).filter((column) => dbColumns.has(column));
  if (columns.length === 0) return;

  const columnIndexes = columns.map((column) => values[0].findIndex((value) => String(value) === column));
  const placeholders = columns.map(() => "?").join(", ");
  const statement = database.prepare(
    `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${placeholders})`,
  );

  values.slice(1).forEach((row) => {
    const params = columnIndexes.map((index) => {
      const value = row[index];
      return value === "" || value === undefined ? null : value;
    });
    statement.run(...params);
  });
}

function restoreSnapshot(database: Database.Database, values: SheetValues) {
  const run = database.transaction(() => {
    DELETE_ORDER.forEach((table) => database.prepare(`DELETE FROM ${quoteIdentifier(table)}`).run());
    INSERT_ORDER.forEach((table) => restoreTable(database, table, values.get(table) ?? []));
  });
  run();
}

async function writeSnapshot(database: Database.Database) {
  await ensureSheets();
  const data = TABLES.map((table) => {
    const columns = tableColumns(database, table);
    const rows = database
      .prepare(`SELECT ${columns.map(quoteIdentifier).join(", ")} FROM ${quoteIdentifier(table)}`)
      .all() as Array<Record<string, unknown>>;
    return {
      range: `${quoteSheet(table)}!A1`,
      values: [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))],
    };
  });

  await sheetsFetch("/values:batchClear", {
    method: "POST",
    body: JSON.stringify({ ranges: TABLES.map((table) => `${quoteSheet(table)}!A:ZZ`) }),
  });
  await sheetsFetch("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
}

export async function ensureGoogleSheetsHydrated(database = getDb()) {
  if (!isGoogleSheetsStoreConfigured()) return;
  if (!isVercel && hydrated) return;
  if (hydratePromise) {
    await hydratePromise;
    if (!isVercel) return;
  }

  hydratePromise = (async () => {
    const values = await readSheets();
    if (sheetHasRows(values)) restoreSnapshot(database, values);
    else await writeSnapshot(database);
    hydrated = true;
  })();

  try {
    await hydratePromise;
  } finally {
    if (isVercel) hydratePromise = null;
  }
}

export async function persistGoogleSheetsSnapshot(database = getDb()) {
  if (!isGoogleSheetsStoreConfigured()) return;
  await writeSnapshot(database);
  hydrated = true;
}
