import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { getDb } from "@/lib/db";
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        ensureSeeded();
        const row = getDb()
          .prepare("SELECT * FROM users WHERE email = ? AND status = 'aktif'")
          .get(credentials.email.toLowerCase()) as AuthUserRow | undefined;

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
