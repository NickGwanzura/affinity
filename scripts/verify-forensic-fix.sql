-- =============================================================================
-- FORENSIC FIX VERIFICATION SCRIPT
-- Run this after deployment to verify all fixes are working correctly
-- =============================================================================

-- =============================================================================
-- 1. VERIFY SCHEMA CHANGES
-- =============================================================================

-- Check clients table has new columns
SELECT 'Clients Table Schema' as check_name;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clients' AND table_schema = 'public'
AND column_name IN ('opening_balance', 'opening_balance_currency', 'is_active', 'deleted_at')
ORDER BY ordinal_position;

-- Check payments table has new columns
SELECT 'Payments Table Schema' as check_name;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'payments' AND table_schema = 'public'
AND column_name IN ('is_deleted', 'created_by', 'updated_by', 'deleted_by', 'updated_at')
ORDER BY ordinal_position;

-- =============================================================================
-- 2. VERIFY FUNCTIONS EXIST
-- =============================================================================

SELECT 'Functions' as check_name;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_client_balance_v2',
    'get_client_ledger',
    'soft_delete_payment',
    'soft_delete_client',
    'payment_auto_set_client_id',
    'invoice_auto_set_client_id'
);

-- =============================================================================
-- 3. VERIFY VIEWS EXIST
-- =============================================================================

SELECT 'Views' as check_name;
SELECT table_name, view_definition IS NOT NULL as has_definition
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('client_balances_v2', 'client_ledger');

-- =============================================================================
-- 4. VERIFY TRIGGERS EXIST
-- =============================================================================

SELECT 'Triggers' as check_name;
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND trigger_name IN ('payment_auto_client_id', 'invoice_auto_client_id');

-- =============================================================================
-- 5. TEST BALANCE CALCULATION
-- =============================================================================

-- Get a sample client to test with
SELECT 'Sample Client for Testing' as check_name;
SELECT id, name, opening_balance, opening_balance_currency, is_active
FROM public.clients 
WHERE is_active = true AND deleted_at IS NULL
LIMIT 1;

-- Test balance function (replace with actual client_id from above)
-- SELECT * FROM public.get_client_balance_v2('REPLACE_WITH_CLIENT_ID'::uuid);

-- =============================================================================
-- 6. VERIFY INDEXES
-- =============================================================================

SELECT 'Performance Indexes' as check_name;
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname IN (
    'idx_clients_is_active',
    'idx_payments_is_deleted',
    'idx_payments_client_date',
    'idx_invoices_client_id',
    'idx_clients_balance_calc'
);

-- =============================================================================
-- 7. CHECK DATA CONSISTENCY
-- =============================================================================

-- Count of clients with opening balance
SELECT 'Clients with Opening Balance' as metric, COUNT(*) as count
FROM public.clients 
WHERE opening_balance != 0 AND opening_balance IS NOT NULL;

-- Count of active vs inactive clients
SELECT 'Active/Inactive Clients' as metric, 
       is_active, 
       COUNT(*) as count
FROM public.clients 
GROUP BY is_active;

-- Count of deleted (soft) payments
SELECT 'Payment Soft Delete Status' as metric,
       is_deleted,
       COUNT(*) as count
FROM public.payments
GROUP BY is_deleted;

-- =============================================================================
-- 8. VERIFY RLS POLICIES
-- =============================================================================

SELECT 'RLS Policies' as check_name;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('clients', 'payments')
ORDER BY tablename, policyname;

-- =============================================================================
-- 9. LEDGER TEST (if you have a client_id)
-- =============================================================================

-- Replace with actual client_id to test
-- SELECT * FROM public.get_client_ledger('REPLACE_WITH_CLIENT_ID'::uuid) LIMIT 10;

-- =============================================================================
-- 10. SUMMARY VERIFICATION
-- =============================================================================

SELECT 'VERIFICATION SUMMARY' as section;

WITH checks AS (
    SELECT 'clients.opening_balance column' as check_item, 
           EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='opening_balance') as passed
    UNION ALL
    SELECT 'clients.is_active column', 
           EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='is_active')
    UNION ALL
    SELECT 'payments.is_deleted column', 
           EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='is_deleted')
    UNION ALL
    SELECT 'get_client_balance_v2 function', 
           EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name='get_client_balance_v2')
    UNION ALL
    SELECT 'get_client_ledger function', 
           EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name='get_client_ledger')
    UNION ALL
    SELECT 'client_balances_v2 view', 
           EXISTS(SELECT 1 FROM information_schema.views WHERE table_name='client_balances_v2')
    UNION ALL
    SELECT 'payment_auto_client_id trigger', 
           EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name='payment_auto_client_id')
)
SELECT check_item, 
       CASE WHEN passed THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM checks
ORDER BY check_item;

-- =============================================================================
-- END OF VERIFICATION
-- =============================================================================

SELECT 'Verification Complete!' as message;
SELECT 'If all checks show ✅ PASS, the forensic fix is correctly deployed.' as next_steps;
