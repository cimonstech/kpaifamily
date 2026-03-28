import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** One-time utility: log a bcrypt hash for SUPER_ADMIN_PASSWORD_HASH. */
export async function generateSuperAdminHash(
  plaintextPassword: string
): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const hash = await hashPassword(plaintextPassword);
  console.log("\nSUPER_ADMIN_EMAIL (from env):", email ?? "(not set)");
  console.log(
    "\nCopy this into your .env.local as SUPER_ADMIN_PASSWORD_HASH:\n"
  );
  console.log(hash);
}
