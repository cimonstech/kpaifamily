import { createHmac } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/session";

const ADMIN_PUBLIC_PREFIXES = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/first-time-reset",
] as const;

function isAdminPublicPath(pathname: string): boolean {
  return ADMIN_PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function verifyViewerCookie(value: string): boolean {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return false;
  const code = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!code || !sig) return false;
  const secret = process.env.JWT_SECRET ?? "fallback";
  const expected = createHmac("sha256", secret)
    .update(code)
    .digest("hex")
    .slice(0, 16);
  return sig === expected;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (
      pathname === "/admin/first-time-reset" ||
      pathname.startsWith("/admin/first-time-reset/")
    ) {
      const resetCookie = request.cookies.get("reset_required")?.value;
      if (!resetCookie) {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
      return NextResponse.next();
    }

    if (isAdminPublicPath(pathname)) {
      return NextResponse.next();
    }

    const token = request.cookies.get("admin_token")?.value;
    const session = token ? await verifyAdminToken(token) : null;

    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    if (pathname === "/admin/audit" || pathname.startsWith("/admin/audit/")) {
      if (session.role !== "super") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
    if (
      pathname === "/admin/settings" ||
      pathname.startsWith("/admin/settings/")
    ) {
      if (session.role !== "super") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }

    return NextResponse.next();
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const viewer = request.cookies.get("viewer_session")?.value;
    if (!viewer || !verifyViewerCookie(viewer)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard", "/dashboard/:path*"],
};
