/**
 * /api/assets/requests — Vercel Serverless Function
 *
 * Delegates to the main assets handler which detects /requests in the URL path.
 * Vercel routes /api/assets/requests here; the handler checks req.url and
 * routes to handleAssetRequests() automatically.
 */
export { default } from '../assets';
