import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error(
      "Usage: npx ts-node scripts/generate-super-admin-hash.ts yourpassword"
    );
    process.exit(1);
  }
  const hash = await hashPassword(password);
  console.log("\nCopy this into your .env.local as SUPER_ADMIN_PASSWORD_HASH:\n");
  console.log(hash);
}

main();
