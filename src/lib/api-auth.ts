import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { canAccessApi } from "@/lib/rbac";
import type { Role } from "@/types";

export async function requireApiPermission(request: Request) {
  const session = await getServerSession(authOptions);
  const pathname = new URL(request.url).pathname;

  if (!session?.user) {
    return {
      response: NextResponse.json({ message: "Autentikasi diperlukan." }, { status: 401 }),
      session: null,
    };
  }

  if (!canAccessApi(session.user.role as Role, pathname, request.method)) {
    return {
      response: NextResponse.json({ message: "Akses role tidak mencukupi." }, { status: 403 }),
      session,
    };
  }

  return { response: null, session };
}
