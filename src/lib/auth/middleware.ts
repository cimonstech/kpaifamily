import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";

export { getAdminSession };

export async function requireAdmin(
  request: NextRequest
): Promise<NextResponse | null> {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return null;
}

export async function requireSuperAdmin(
  request: NextRequest
): Promise<NextResponse | null> {
  const session = await getAdminSession(request);
  if (!session || session.role !== "super") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return null;
}
