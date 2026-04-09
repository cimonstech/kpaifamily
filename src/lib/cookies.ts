/**
 * Whether to set the `Secure` flag on auth cookies.
 * Browsers do not persist Secure cookies on plain HTTP (e.g. http://localhost),
 * so login appears to succeed then immediately bounces back to the login page.
 */
export function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}
