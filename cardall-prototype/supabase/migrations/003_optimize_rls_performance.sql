-- Optimize RLS policies for better performance
-- This migration addresses performance issues identified by Supabase Advisor
-- Replace auth.uid() with (select auth.uid()) to avoid per-row re-evaluation

-- Drop existing RLS policies that have performance issues
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

DROP POLICY IF EXISTS "Users can view own folders" ON folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON folders;
DROP POLICY IF EXISTS "Users can update own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON folders;

DROP POLICY IF EXISTS "Users can view own cards" ON cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON cards;
DROP POLICY IF EXISTS "Users can update own cards" ON cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON cards;

DROP POLICY IF EXISTS "Users can view own tags" ON tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
DROP POLICY IF EXISTS "Users can update own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

DROP POLICY IF EXISTS "Users can view own images" ON images;
DROP POLICY IF EXISTS "Users can insert own images" ON images;
DROP POLICY IF EXISTS "Users can update own images" ON images;
DROP POLICY IF EXISTS "Users can delete own images" ON images;

-- Create optimized RLS policies using (select auth.uid()) pattern
-- Users table policies
CREATE POLICY "Users can view own profile" ON users
FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON users
FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile" ON users
FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- Folders table policies
CREATE POLICY "Users can view own folders" ON folders
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own folders" ON folders
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own folders" ON folders
FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own folders" ON folders
FOR DELETE USING ((select auth.uid()) = user_id);

-- Cards table policies
CREATE POLICY "Users can view own cards" ON cards
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own cards" ON cards
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own cards" ON cards
FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own cards" ON cards
FOR DELETE USING ((select auth.uid()) = user_id);

-- Tags table policies
CREATE POLICY "Users can view own tags" ON tags
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own tags" ON tags
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own tags" ON tags
FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own tags" ON tags
FOR DELETE USING ((select auth.uid()) = user_id);

-- Images table policies
CREATE POLICY "Users can view own images" ON images
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own images" ON images
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own images" ON images
FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own images" ON images
FOR DELETE USING ((select auth.uid()) = user_id);

-- Add optimized indexes for better query performance
-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_cards_user_folder ON cards(user_id, folder_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_cards_user_updated ON cards(user_id, updated_at) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_cards_user_sync ON cards(user_id, sync_version) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_folders_user_updated ON folders(user_id, updated_at) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, name) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tags_user_updated ON tags(user_id, updated_at) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_images_user_card ON images(user_id, card_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_images_user_updated ON images(user_id, updated_at) WHERE is_deleted = false;

-- Update function to use stable search path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = public;

-- Create function for user profile management with proper search path
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure user profile exists when auth user is created
    INSERT INTO public.users (id, email, username)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text, 1, 8)))
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = public SECURITY DEFINER;