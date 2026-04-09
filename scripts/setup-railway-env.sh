#!/bin/bash
# =============================================================================
# Setup Railway Environment Variables for Affinity CRM
# =============================================================================

echo "Setting up Railway environment variables..."
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in. Run: railway login"
    exit 1
fi

# Check if project is linked
if ! railway status &> /dev/null; then
    echo "❌ No project linked. Run: railway link"
    exit 1
fi

echo "✅ Railway CLI ready"
echo ""
echo "Setting environment variables..."
echo ""

# Database (Required)
railway variables set NEON_DATABASE_URL="postgresql://neondb_owner:npg_KuEdvM6D3YLP@ep-shiny-glitter-ah22khor-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# JWT Secret (Generate a new one for production!)
railway variables set JWT_SECRET="$(openssl rand -hex 32)"

# API URL
railway variables set VITE_API_URL="/api"

# Allowed Origins (update with your Railway domain after first deploy)
railway variables set ALLOWED_ORIGINS="https://your-railway-domain.up.railway.app"

# Supabase (public - safe to expose)
railway variables set VITE_SUPABASE_URL="https://bujvjyucylvdwgdkcxvj.supabase.co"
railway variables set VITE_SUPABASE_ANON_KEY="sb_publishable_BdlikUNCRQvOc_qN_j481Q_kBAzeXl5"

# Node Environment
railway variables set NODE_ENV="production"

echo ""
echo "✅ Environment variables set!"
echo ""
echo "Verify with: railway variables"
echo ""
echo "⚠️  IMPORTANT: Update ALLOWED_ORIGINS after your first deploy!"
echo "   Get your domain from: railway status"
