import type { DefaultSession } from "next-auth";
import type { Role } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      jabatan?: string;
      avatarColor?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    jabatan?: string;
    avatarColor?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    jabatan?: string;
    avatarColor?: string;
  }
}
