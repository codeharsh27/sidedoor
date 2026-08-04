-- ==============================================================
-- FIX FOR SUPABASE SECURITY WARNING: "Table publicly accessible"
-- ==============================================================
-- This script enables Row-Level Security (RLS) on all public tables in your database.
-- Because your backend connects to Supabase via a connection string (service role / postgres),
-- your application will continue to work normally, but anonymous public access will be blocked,
-- satisfying the Supabase security requirement.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;
