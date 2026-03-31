import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public admin routes - no auth needed
  if (
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/forgot-password") ||
    pathname.startsWith("/admin/reset-password")
  ) {
    return NextResponse.next();
  }

  // First time reset - needs reset_required cookie
  if (pathname.startsWith("/admin/first-time-reset")) {
    const resetCookie = request.cookies.get("reset_required")?.value;
    if (!resetCookie) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // All other admin routes - need admin_token
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    // Super admin only routes
    if (
      (pathname.startsWith("/admin/audit") ||
        pathname.startsWith("/admin/settings")) &&
      payload.role !== "super"
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Dashboard - need viewer_session cookie (any non-empty value)
  if (pathname.startsWith("/dashboard")) {
    const viewerSession = request.cookies.get("viewer_session")?.value;
    if (!viewerSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/expenses")) {
    const viewerSession = request.cookies.get("viewer_session")?.value;
    if (!viewerSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard", "/dashboard/:path*", "/expenses", "/expenses/:path*"],
};
