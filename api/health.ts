import type { ApiRequest, ApiResponse } from './_types.js';
import { setSecurityHeaders, handleCors } from './_middleware.js';
import { sql, checkConnection } from './_db.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const checks = {
      database: false,
      timestamp: new Date().toISOString(),
    };
    
    // Check database connection
    checks.database = await checkConnection();
    
    if (!checks.database) {
      return res.status(503).json({
        status: 'unhealthy',
        checks,
      });
    }
    
    // Get additional stats
    const [vehicleCount, clientCount, invoiceCount] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM vehicles`,
      sql`SELECT COUNT(*) as count FROM clients`,
      sql`SELECT COUNT(*) as count FROM invoices`,
    ]);
    
    res.status(200).json({
      status: 'healthy',
      checks,
      stats: {
        vehicles: parseInt(vehicleCount[0].count),
        clients: parseInt(clientCount[0].count),
        invoices: parseInt(invoiceCount[0].count),
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
