import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { getDb } from "@/lib/db";
import { ensureGoogleSheetsHydrated } from "@/lib/google-sheets-store";
import { ensureSeeded } from "@/lib/seed";
import type { Role } from "@/types";

type AuthUserRow = {
  id: number;
  nama: string;
  email: string;
  password_hash: string;
  role: Role;
  jabatan: string | null;
  avatar_color: string | null;
  status: string;
};

const demoCredential = {
  username: "demo",
  password: "demo",
  nama: "Demo Super Akses",
  role: "kasiwas" as Role,
  jabatan: "Super Akses SIMPATIK",
  avatarColor: "#0A8090",
};

const credentialAliases: Record<string, Role> = {
  "kepala@simpatik.local": "kepala_kpp",
  "kasiwas@simpatik.local": "kasiwas",
  "ar1@simpatik.local": "ar",
  "teknisi1@simpatik.local": "teknisi",
};

function ensureDemoUser() {
  const database = getDb();
  const passwordHash = bcrypt.hashSync(demoCredential.password, 10);
  const existing = database.prepare("SELECT * FROM users WHERE email = ?").get(demoCredential.username) as
    | AuthUserRow
    | undefined;

  if (existing) {
    database
      .prepare(
        `
          UPDATE users
          SET nama = ?, password_hash = ?, role = ?, jabatan = ?, avatar_color = ?, status = 'aktif'
          WHERE id = ?
        `,
      )
      .run(
        demoCredential.nama,
        passwordHash,
        demoCredential.role,
        demoCredential.jabatan,
        demoCredential.avatarColor,
        existing.id,
      );

    return database.prepare("SELECT * FROM users WHERE id = ?").get(existing.id) as AuthUserRow;
  }

  const result = database
    .prepare(
      `
        INSERT INTO users (nama, email, password_hash, nip, jabatan, role, phone, avatar_color, status)
        VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, 'aktif')
      `,
    )
    .run(
      demoCredential.nama,
      demoCredential.username,
      passwordHash,
      demoCredential.jabatan,
      demoCredential.role,
      demoCredential.avatarColor,
    );

  return database.prepare("SELECT * FROM users WHERE id = ?").get(Number(result.lastInsertRowid)) as AuthUserRow;
}

function findAuthUser(email: string) {
  const database = getDb();
  const exact = database
    .prepare("SELECT * FROM users WHERE email = ? AND status = 'aktif'")
    .get(email) as AuthUserRow | undefined;

  if (exact) return exact;

  const role = credentialAliases[email];
  if (!role) return undefined;

  return database
    .prepare("SELECT * FROM users WHERE role = ? AND status = 'aktif' ORDER BY id LIMIT 1")
    .get(role) as AuthUserRow | undefined;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET ?? "simpatik-local-development-secret",
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "SIMPATIK",
      credentials: {
        email: { label: "Username / Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        ensureSeeded();
        await ensureGoogleSheetsHydrated();
        const normalizedLogin = credentials.email.toLowerCase().trim();
        const isDemoLogin =
          normalizedLogin === demoCredential.username && credentials.password === demoCredential.password;
        const row = isDemoLogin ? ensureDemoUser() : findAuthUser(normalizedLogin);

        if (!row) return null;

        const valid = await bcrypt.compare(credentials.password, row.password_hash);
        if (!valid) return null;

        return {
          id: String(row.id),
          name: row.nama,
          email: row.email,
          role: row.role,
          jabatan: row.jabatan ?? undefined,
          avatarColor: row.avatar_color ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.jabatan = user.jabatan;
        token.avatarColor = user.avatarColor;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.jabatan = token.jabatan;
        session.user.avatarColor = token.avatarColor;
      }
      return session;
    },
  },
};
