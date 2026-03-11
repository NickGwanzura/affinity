/**
 * Generate password hash and salt for new user
 * Uses the same algorithm as authService.ts
 */

import crypto from 'crypto';

const SALT_LENGTH = 16;
const HASH_ITERATIONS = 100000;
const HASH_ALGORITHM = 'sha256';

function generateSalt() {
  const salt = crypto.randomBytes(SALT_LENGTH);
  return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = Buffer.from(password + salt, 'utf8');
  
  let hash = crypto.createHash(HASH_ALGORITHM).update(data).digest();
  
  // Multiple iterations for security
  for (let i = 0; i < HASH_ITERATIONS; i++) {
    hash = crypto.createHash(HASH_ALGORITHM).update(hash).digest();
  }
  
  return hash.toString('hex');
}

async function main() {
  const email = 'elton.mapfekat@gmail.com';
  const password = 'Affinity@2030';
  const name = 'Elton Mapfekat';  // Extracted from email
  const role = 'Admin';  // Default role, change as needed
  
  console.log('Generating credentials for new user...\n');
  console.log('Email:', email);
  console.log('Name:', name);
  console.log('Role:', role);
  console.log('');
  
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  
  console.log('Generated Salt:', salt);
  console.log('Generated Hash:', hash);
  console.log('');
  console.log('========================================');
  console.log('SQL TO INSERT USER:');
  console.log('========================================');
  console.log(`INSERT INTO public.user_profiles (email, name, role, status, password_hash, password_salt, created_at, updated_at)
VALUES (
  '${email}',
  '${name}',
  '${role}',
  'Active',
  '${hash}',
  '${salt}',
  NOW(),
  NOW()
)
RETURNING id, email, name, role, status;`);
  console.log('');
  console.log('========================================');
  console.log('JSON FOR API/SCRIPT:');
  console.log('========================================');
  console.log(JSON.stringify({
    email,
    name,
    role,
    status: 'Active',
    password_hash: hash,
    password_salt: salt
  }, null, 2));
}

main().catch(console.error);
