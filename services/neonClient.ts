/**
 * Neon Database Client
 * 
 * This module provides the connection to Neon PostgreSQL database.
 * Supabase is retained for Auth only - all database operations use Neon.
 * 
 * Connection pooling is handled by the Neon serverless driver.
 */

import { neon, neonConfig } from '@neondatabase/serverless';

// Configure Neon for browser environment
neonConfig.fetchConnectionCache = true;

// Get database URL from environment
const neonDatabaseUrl = import.meta.env.VITE_NEON_DATABASE_URL;

// Validation
if (!neonDatabaseUrl) {
  console.error('❌ [NEON] CRITICAL: Missing VITE_NEON_DATABASE_URL environment variable');
  console.error('❌ [NEON] Database operations will fail until Neon is configured');
  console.error('❌ [NEON] Please add VITE_NEON_DATABASE_URL to your .env file');
}

// Create the SQL query function
// This is the main interface for executing queries against Neon
export const sql = neonDatabaseUrl ? neon(neonDatabaseUrl) : null;

// Connection status
export const isNeonConnected = (): boolean => {
  const connected = !!neonDatabaseUrl && !!sql;
  if (!connected) {
    console.warn('⚠️ [NEON] isNeonConnected: false - URL:', !!neonDatabaseUrl, 'SQL:', !!sql);
  }
  return connected;
};

// Health check function with detailed diagnostics
export const checkNeonConnection = async (): Promise<boolean> => {
  if (!neonDatabaseUrl) {
    console.error('❌ [NEON] Health check failed: VITE_NEON_DATABASE_URL not set');
    return false;
  }
  
  if (!sql) {
    console.error('❌ [NEON] Health check failed: SQL client not initialized');
    return false;
  }
  
  try {
    const startTime = Date.now();
    const result = await sql`SELECT 1 as health_check, NOW() as server_time`;
    const elapsed = Date.now() - startTime;
    
    return result.length > 0;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [NEON] Connection health check FAILED:', {
      error: errorMessage
    });
    return false;
  }
};

// Diagnostic function to check table existence
export const checkTableExists = async (tableName: string): Promise<boolean> => {
  if (!sql) return false;
  
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ) as exists
    `;
    return result[0]?.exists === true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [NEON] Error checking table '${tableName}':`, errorMessage);
    return false;
  }
};

// Full diagnostics - check all required tables
export const runFullDiagnostics = async (): Promise<{
  connected: boolean;
  tables: Record<string, boolean>;
  errors: string[];
}> => {
  const errors: string[] = [];
  const tables: Record<string, boolean> = {};
  
  const requiredTables = [
    'vehicles', 'expenses', 'quotes', 'invoices', 'payments',
    'company_details', 'user_profiles', 'registration_requests',
    'clients', 'employees', 'payslips', 'invites',
    'quote_items', 'invoice_items'
  ];
  
  // Check connection
  const connected = await checkNeonConnection();
  if (!connected) {
    errors.push('Database connection failed');
    return { connected, tables, errors };
  }
  
  // Check each table
  for (const table of requiredTables) {
    const exists = await checkTableExists(table);
    tables[table] = exists;
    if (!exists) {
      errors.push(`Missing table: ${table}`);
    }
  }
  
  return { connected, tables, errors };
};

if (!neonDatabaseUrl) {
  console.error('❌ [NEON] Client NOT initialized - add VITE_NEON_DATABASE_URL to .env');
}

/**
 * Helper function to safely execute queries with error handling
 */
export async function executeQuery<T>(
  queryFn: () => Promise<T>,
  operation: string
): Promise<T> {
  if (!sql) {
    const error = `[NEON] Cannot execute ${operation}: Database not connected. Please configure VITE_NEON_DATABASE_URL.`;
    console.error('❌', error);
    throw new Error(error);
  }
  
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    return result;
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [NEON] Error in ${operation} (${elapsed}ms):`, {
      message: errorMessage
    });
    throw error;
  }
}
