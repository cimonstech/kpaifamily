import { jwtVerify, SignJWT } from "jose";

const ADMIN_TOKEN_COOKIE = "admin_token";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

function getCookieFromRequest(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    if (key === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return null;
}

const JWT_ISSUER = "kpai-family";
const JWT_AUDIENCE = "kpai-admin";

export async function signAdminToken(payload: {
  id: string;
  email: string;
  role: "super" | "admin";
}): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({
    id: payload.id,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime("8h")
    .sign(secret);
}

export async function verifyAdminToken(
  token: string
): Promise<{ id: string; email: string; role: "super" | "admin" } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
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

export async function getAdminSession(
  request: Request
): Promise<{ id: string; email: string; role: "super" | "admin" } | null> {
  const token = getCookieFromRequest(request, ADMIN_TOKEN_COOKIE);
  if (!token) return null;
  return verifyAdminToken(token);
}
