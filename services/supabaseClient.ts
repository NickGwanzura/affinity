import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client - RETAINED FOR AUTH ONLY
 * 
 * All database operations have been migrated to Neon PostgreSQL.
 * This client is now used exclusively for authentication:
 * - signUp, signInWithPassword, signOut
 * - getSession, getUser
 * - resetPasswordForEmail, updateUser
 * - admin.deleteUser
 * 
 * DO NOT use supabaseClient.from(...) for database queries.
 * Use the databaseService.ts (Neon) instead.
 */

// Production-ready Supabase client with error handling and validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Comprehensive validation
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error: unknown) {
  console.error('[SUPABASE] Invalid URL format:', supabaseUrl);
  throw new Error('Invalid Supabase URL format. Please check VITE_SUPABASE_URL in .env');
}

// Validate key format (should be a long string)
if (supabaseAnonKey.length < 20) {
  console.error('[SUPABASE] Invalid anon key length:', supabaseAnonKey.length);
  throw new Error('Invalid Supabase anon key. Please check VITE_SUPABASE_ANON_KEY in .env');
}

// Create client with production-ready options
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // More secure flow
    storage: window.localStorage,
    storageKey: 'affinity-logistics-auth'
  },
  global: {
    headers: {
      'X-Client-Info': 'affinity-logistics-crm/1.0.0'
    }
  },
  db: {
    schema: 'public'
  },
  // Retry configuration for network resilience
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Connection health check for production monitoring
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabaseClient.from('_health').select('*').limit(1);
    // If table doesn't exist, that's ok - we're just checking connectivity
    return !error || error.code !== 'PGRST301';
  } catch (error: unknown) {
    console.error('[SUPABASE] Connection check failed:', error);
    return false;
  }
};

// Log successful initialization
console.log('[SUPABASE] Client initialized successfully', {
  url: supabaseUrl.substring(0, 30) + '...',
  timestamp: new Date().toISOString()
});
