#!/bin/bash
# Forensic Fix Deployment Script
# Run this script to deploy the financial system fixes

set -e

echo "🔥 FORENSIC FIX DEPLOYMENT"
echo "=========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable not set${NC}"
    echo "Please set it to your PostgreSQL connection string:"
    echo "export DATABASE_URL='postgres://user:pass@host:port/dbname'"
    exit 1
fi

echo -e "${YELLOW}Step 1: Running database migration...${NC}"
echo "This will update the clients and payments tables."
echo ""

# Run the migration
if psql "$DATABASE_URL" -f FORENSIC_FIX_MIGRATION_v2.sql; then
    echo -e "${GREEN}✅ Database migration completed successfully${NC}"
else
    echo -e "${RED}❌ Database migration failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Building application...${NC}"

# Build the application
if npm run build; then
    echo -e "${GREEN}✅ Build completed successfully${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Type checking...${NC}"

# Run TypeScript check
if npx tsc --noEmit; then
    echo -e "${GREEN}✅ Type check passed${NC}"
else
    echo -e "${RED}❌ Type check failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 4: Linting...${NC}"

# Run linting
if npm run lint; then
    echo -e "${GREEN}✅ Linting passed${NC}"
else
    echo -e "${YELLOW}⚠️ Linting issues found (non-blocking)${NC}"
fi

echo ""
echo "=========================="
echo -e "${GREEN}✅ FORENSIC FIX DEPLOYMENT READY${NC}"
echo "=========================="
echo ""
echo "Next steps:"
echo "1. Deploy to Vercel: vercel --prod"
echo "2. Verify the fix:"
echo "   - Open Client Directory"
echo "   - Check balance displays correctly"
echo "   - Test payment without invoice"
echo ""
echo "Rollback (if needed):"
echo "  psql \$DATABASE_URL -f FORENSIC_FIX_MIGRATION_v2.sql --section=rollback"
