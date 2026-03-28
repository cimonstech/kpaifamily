import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/** Must match src/lib/auth/session.ts */
const JWT_ISSUER = "kpai-family";
const JWT_AUDIENCE = "kpai-admin";

function getJwtSecretKey(): Uint8Array | null {
  const s = process.env.JWT_SECRET;
  if (!s) return null;
  return new TextEncoder().encode(s);
}

async function verifyAdminJwt(token: string): Promise<{
  id: string;
  email: string;
  role: "super" | "admin";
} | null> {
  const secret = getJwtSecretKey();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const id = payload.id;
    const email = payload.email;
    const role = payload.role;
    if (
      typeof id !== "string" ||
      typeof email !== "string" ||
      (role !== "super" && role !== "admin")
    ) {
      return null;
    }
    return { id, email, role };
  } catch {
    return null;
  }
}

/** Same shape as Node createHmac("sha256", secret).update(code).digest("hex").slice(0, 16) */
async function viewerCookieSignatureHex(secret: string, code: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(code));
  const bytes = new Uint8Array(buf);
  const fullHex = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  return fullHex.slice(0, 16);
}

async function verifyViewerCookie(value: string): Promise<boolean> {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return false;
  const code = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!code || !sig) return false;
  const secret = process.env.JWT_SECRET ?? "fallback";
  try {
    const expected = await viewerCookieSignatureHex(secret, code);
    return sig === expected;
  } catch {
    return false;
  }
}

const ADMIN_PUBLIC_PREFIXES = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
] as const;

function isAdminPublicPath(pathname: string): boolean {
  return ADMIN_PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
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
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    const payload = await verifyAdminJwt(token);
    if (!payload) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    if (pathname === "/admin/audit" || pathname.startsWith("/admin/audit/")) {
      if (payload.role !== "super") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
    if (
      pathname === "/admin/settings" ||
      pathname.startsWith("/admin/settings/")
    ) {
      if (payload.role !== "super") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }

    return NextResponse.next();
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const viewer = request.cookies.get("viewer_session")?.value;
    if (!viewer || !(await verifyViewerCookie(viewer))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard", "/dashboard/:path*"],
};
