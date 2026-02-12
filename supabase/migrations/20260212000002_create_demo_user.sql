-- Create demo user for shared demo mode access
-- This user can be used by prospects to evaluate the system without QuickBooks OAuth

-- Note: This migration uses Supabase's auth.users table
-- The password hash is for: 'demo-peninsula-2026-secure'
-- In production, you should manually create this user via Supabase Dashboard
-- or use the Supabase Management API with the service role key

-- For local development, manually create the user in Supabase Dashboard:
-- Email: demo@peninsula-internal.local
-- Password: demo-peninsula-2026-secure
-- Auto Confirm User: Yes

-- Comment: This migration serves as documentation. The demo user should be
-- created manually in the Supabase Dashboard > Authentication > Users
-- to ensure proper password hashing and email confirmation.
