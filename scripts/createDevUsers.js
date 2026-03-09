import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bujvjyucylvdwgdkcxvj.supabase.co';
const supabaseAnonKey = 'sb_publishable_BdlikUNCRQvOc_qN_j481Q_kBAzeXl5';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const devUsers = [
  {
    email: 'admin@affinity.dev',
    password: 'Admin123!',
    name: 'Dev Admin',
    role: 'Admin'
  },
  {
    email: 'manager@affinity.dev',
    password: 'Manager123!',
    name: 'Dev Manager',
    role: 'Manager'
  },
  {
    email: 'driver@affinity.dev',
    password: 'Driver123!',
    name: 'Dev Driver',
    role: 'Driver'
  }
];

async function createDevUsers() {
  console.log('Creating dev users for express development...\n');
  
  let successCount = 0;
  let errorCount = 0;

  for (const user of devUsers) {
    try {
      console.log(`Creating user: ${user.email}...`);
      
      const { data, error } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            name: user.name,
            role: user.role
          }
        }
      });

      if (error) {
        // Check if user already exists
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          console.log(`⚠️  User already exists: ${user.email}`);
        } else {
          console.error(`❌ Error creating ${user.email}:`, error.message);
          errorCount++;
        }
      } else {
        console.log(`✅ Created: ${user.email} (${user.role})`);
        successCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.error(`❌ Unexpected error for ${user.email}:`, err.message);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log('Dev Users Creation Complete!');
  console.log('========================================');
  console.log(`✅ Successfully created: ${successCount} users`);
  if (errorCount > 0) {
    console.log(`❌ Failed: ${errorCount} users`);
  }
  console.log('\nQuick Login Credentials:');
  console.log('------------------------');
  devUsers.forEach(user => {
    console.log(`${user.role.padEnd(10)}: ${user.email} / ${user.password}`);
  });
  console.log('\nNote: If email confirmation is enabled in Supabase, check your email.');
  console.log('You can disable email confirmation in: Authentication > Providers > Email');
}

createDevUsers();
