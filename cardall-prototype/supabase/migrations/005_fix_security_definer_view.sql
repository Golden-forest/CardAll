-- Fix Security Definer View issue
-- Replace or remove the problematic realtime_index_performance view

-- First, let's check if the view exists and drop it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'realtime_index_performance' AND table_schema = 'public') THEN
        DROP VIEW public.realtime_index_performance;
        RAISE NOTICE 'Dropped security definer view: realtime_index_performance';
    END IF;
END $$;

-- Create a safer alternative for performance monitoring if needed
CREATE OR REPLACE VIEW public.performance_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('cards', 'folders', 'tags', 'images', 'users');

-- Grant appropriate permissions
GRANT SELECT ON public.performance_stats TO authenticated;
GRANT SELECT ON public.performance_stats TO service_role;

-- Add comment explaining the change
COMMENT ON VIEW public.performance_stats IS 'Safe performance statistics view, replaces security definer view';