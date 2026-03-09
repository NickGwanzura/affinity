#!/bin/bash
# Script to add environment variables to Vercel

echo "Adding environment variables to Vercel..."

# Check if logged in
npx vercel whoami || { echo "Please login first: npx vercel login"; exit 1; }

# Add environment variables
echo "Adding VITE_SUPABASE_URL..."
echo "https://bujvjyucylvdwgdkcxvj.supabase.co" | npx vercel env add VITE_SUPABASE_URL production

echo "Adding VITE_SUPABASE_ANON_KEY..."
echo "sb_publishable_BdlikUNCRQvOc_qN_j481Q_kBAzeXl5" | npx vercel env add VITE_SUPABASE_ANON_KEY production

echo "✅ Environment variables added!"
echo ""
echo "Deploy with: npx vercel --prod"
