import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

/** Same HMAC shape as `src/app/api/codes/validate/route.ts` — Web Crypto only (Edge). */
async function verifyViewerSession(value: string): Promise<boolean> {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return false;
  const code = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!code || !sig) return false;
  const jwtSecret = process.env.JWT_SECRET ?? "fallback";
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const buf = await crypto.subtle.sign("HMAC", key, enc.encode(code));
    const bytes = new Uint8Array(buf);
    const fullHex = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
    return sig === fullHex.slice(0, 16);
  } catch {
    return false;
  }
}

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "kpai-family",
      audience: "kpai-admin",
    });
    return payload as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin/first-time-reset")) {
    const resetCookie = request.cookies.get("reset_required")?.value;
    if (!resetCookie) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  const publicAdminRoutes = [
    "/admin/login",
    "/admin/forgot-password",
    "/admin/reset-password",
  ];

  if (publicAdminRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (
      (pathname.startsWith("/admin/audit") ||
        pathname.startsWith("/admin/settings")) &&
      payload.role !== "super"
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    const viewerSession = request.cookies.get("viewer_session")?.value;
    if (!viewerSession || !(await verifyViewerSession(viewerSession))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard", "/dashboard/:path*"],
};
