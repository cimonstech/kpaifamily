import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npx ts-node scripts/hash-password.ts <password>');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
console.log('Password hash:');
console.log(hash);
