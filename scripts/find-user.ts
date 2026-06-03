import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

async function main() {
  // Find maxmos
  const users = await sql.query(
    'SELECT id, name, email, role, access_role, status FROM user_profiles WHERE LOWER(name) LIKE $1 ORDER BY name',
    ['%magede%']
  );

  if (users.length > 0) {
    console.log('Found user:', JSON.stringify(users, null, 2));
  } else {
    console.log('No user found matching "magede"');
  }

  // List all users
  const all = await sql.query(
    'SELECT id, name, email, role, access_role, status FROM user_profiles ORDER BY name'
  );
  console.log('\nAll users:');
  all.forEach((u: any) => {
    console.log(`  ${u.name} (${u.email}) - role: ${u.role}, status: ${u.status}, access: ${u.access_role}`);
  });
}

main().catch(e => console.error('Error:', e.message));
