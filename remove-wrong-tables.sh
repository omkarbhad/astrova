#!/bin/bash

# Astrova Database Cleanup Script - Remove Unused Tables
# This script removes tables from the wrong schema (unprefixed)

set -e

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please export DATABASE_URL or set it in your .env file"
    exit 1
fi

echo "🔍 Astrova Database Table Analysis"
echo "=================================="
echo ""

echo "Current tables in database:"
psql "$DATABASE_URL" "\dt"

echo ""
echo "📋 Analysis:"
echo "- astrova_* tables: CORRECT schema (keep these)"
echo "- Unprefixed tables: WRONG schema (remove these)"
echo ""

echo "⚠️  This will remove tables from the WRONG schema only."
echo "Tables to be removed:"
echo "  - users (wrong schema, should be astrova_users)"
echo "  - credit_transactions (wrong schema, should be astrova_credit_log)"
echo "  - knowledge_base (wrong schema, should be astrova_knowledge_base)"
echo "  - admin_config (wrong schema, should be astrova_admin_config)"
echo "  - user_settings (wrong schema, should be astrova_user_settings)"
echo "  - chat_sessions (wrong schema, should be astrova_chat_sessions)"
echo "  - saved_charts (wrong schema, should be astrova_saved_charts)"
echo ""

read -p "Continue removing wrong schema tables? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing wrong schema tables..."
    
    psql "$DATABASE_URL" << EOF
-- Drop tables from wrong schema (unprefixed)
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS admin_config CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS saved_charts CASCADE;

-- Note: enabled_models table exists in both schemas, keep the existing one
EOF
    
    echo "✅ Wrong schema tables removed"
    echo ""
    echo "📊 Remaining tables (correct schema):"
    psql "$DATABASE_URL" "\dt"
else
    echo "❌ Operation cancelled"
fi
