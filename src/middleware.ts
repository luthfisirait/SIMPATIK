import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

import { canAccessApi, canAccessPage } from "@/lib/rbac";
import type { Role } from "@/types";

const PUBLIC_PATH_PREFIXES = ["/api/auth", "/_next", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? "simpatik-local-development-secret",
  });

  if (pathname.startsWith("/login")) {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Autentikasi diperlukan." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as Role | undefined;

  if (pathname.startsWith("/api/") && !canAccessApi(role, pathname, request.method)) {
    return NextResponse.json({ message: "Akses role tidak mencukupi." }, { status: 403 });
  }

  if (!pathname.startsWith("/api/") && !canAccessPage(role, pathname)) {
    const deniedUrl = new URL("/dashboard", request.url);
    deniedUrl.searchParams.set("denied", "1");
    return NextResponse.redirect(deniedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
