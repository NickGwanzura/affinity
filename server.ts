/* global process */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Adapt Express req/res to the Vercel handler signature.
// Vercel handlers commonly `return apiError(...)` which yields a VercelResponse,
// so the return type must permit both void and VercelResponse.
type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>;
function mount(handler: Handler) {
  return (req: express.Request, res: express.Response) =>
    handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
}

// --- API routes ---
const { default: authHandler } = await import('./api/auth.js');
const { default: clientsHandler } = await import('./api/clients.js');
const { default: clientFinancialsHandler } = await import('./api/client-financials.js');
const { default: companyHandler } = await import('./api/company.js');
const { default: employeesHandler } = await import('./api/employees.js');
const { default: expensesHandler } = await import('./api/expenses.js');
const { default: healthHandler } = await import('./api/health.js');
const { default: invitesHandler } = await import('./api/invites.js');
const { default: invoicesHandler } = await import('./api/invoices.js');
const { default: operatingFundsHandler } = await import('./api/operating-funds.js');
const { default: paymentsHandler } = await import('./api/payments.js');
const { default: payslipsHandler } = await import('./api/payslips.js');
const { default: quotesHandler } = await import('./api/quotes.js');
const { default: receiptsHandler } = await import('./api/receipts.js');
const { default: registrationRequestsHandler } = await import('./api/registration-requests.js');
const { default: tripsHandler } = await import('./api/trips.js');
const { default: usersHandler } = await import('./api/users.js');
const { default: vehiclesHandler } = await import('./api/vehicles.js');
const { default: assetsHandler } = await import('./api/assets.js');
const { default: aiHandler } = await import('./api/ai.js');
const { default: auditLogsHandler } = await import('./api/audit-logs.js');
const { default: emailsHandler } = await import('./api/emails.js');

// Admin routes
const { default: adminApprovalsHandler } = await import('./api/admin/approvals.js');
const { default: adminLogsHandler } = await import('./api/admin/logs.js');
const { default: adminMetricsHandler } = await import('./api/admin/metrics.js');
const { default: adminSubmissionsHandler } = await import('./api/admin/submissions.js');
const { default: adminSystemHandler } = await import('./api/admin/system.js');
const { default: adminUsersHandler } = await import('./api/admin/users.js');

// Lightweight health/ping — no DB, used by Railway health check
app.get('/ping', (_req, res) => res.status(200).json({ ok: true }));

app.all('/api/auth', mount(authHandler));
app.all('/api/clients', mount(clientsHandler));
app.all('/api/client-financials', mount(clientFinancialsHandler));
app.all('/api/company', mount(companyHandler));
app.all('/api/employees', mount(employeesHandler));
app.all('/api/expenses', mount(expensesHandler));
app.all('/api/health', mount(healthHandler));
app.all('/api/invites', mount(invitesHandler));
app.all('/api/invoices', mount(invoicesHandler));
app.all('/api/operating-funds', mount(operatingFundsHandler));
app.all('/api/payments', mount(paymentsHandler));
app.all('/api/payslips', mount(payslipsHandler));
app.all('/api/quotes', mount(quotesHandler));
app.all('/api/receipts', mount(receiptsHandler));
app.all('/api/registration-requests', mount(registrationRequestsHandler));
app.all('/api/trips', mount(tripsHandler));
app.all('/api/users', mount(usersHandler));
app.all('/api/vehicles', mount(vehiclesHandler));
app.all('/api/assets', mount(assetsHandler));
app.all('/api/ai', mount(aiHandler));
app.all('/api/audit-logs', mount(auditLogsHandler));
app.all('/api/emails', mount(emailsHandler));

app.all('/api/admin/approvals', mount(adminApprovalsHandler));
app.all('/api/admin/logs', mount(adminLogsHandler));
app.all('/api/admin/metrics', mount(adminMetricsHandler));
app.all('/api/admin/submissions', mount(adminSubmissionsHandler));
app.all('/api/admin/system', mount(adminSystemHandler));
app.all('/api/admin/users', mount(adminUsersHandler));

// Serve Vite build output — hashed assets are immutable, index.html must not be cached
app.use(
  '/assets',
  express.static(join(__dirname, 'dist', 'assets'), {
    maxAge: '1y',
    immutable: true,
  })
);
app.use(
  express.static(join(__dirname, 'dist'), {
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// SPA fallback — let React Router handle client-side routes
// Exclude /assets paths so missing hashed chunks return 404, not HTML
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/assets/')) {
    return res.status(404).end();
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
