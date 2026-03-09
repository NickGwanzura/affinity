import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bujvjyucylvdwgdkcxvj.supabase.co';
const supabaseAnonKey = 'sb_publishable_BdlikUNCRQvOc_qN_j481Q_kBAzeXl5';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createSuperUser() {
  console.log('Creating super user account...');
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: 'gwanzuranicholas@gmail.com',
      password: 'asdf_1234',
      options: {
        data: {
          name: 'Nicholas Gwanzura',
          role: 'Admin'
        }
      }
    });

    if (error) {
      console.error('Error creating user:', error.message);
      process.exit(1);
    }

    console.log('✅ Super user created successfully!');
    console.log('Email:', 'gwanzuranicholas@gmail.com');
    console.log('Role: Admin');
    console.log('');
    console.log('Note: Check your email for verification link if required by Supabase settings.');
    console.log('You can now login with these credentials.');
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

createSuperUser();
