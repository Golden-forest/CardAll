-- Clean up unused indexes identified by Supabase Advisor
-- These indexes have never been used and can be safely removed

-- Drop unused indexes for cards table
DROP INDEX IF EXISTS idx_cards_conflict_detection;
DROP INDEX IF EXISTS idx_cards_user_timestamp_range;
DROP INDEX IF EXISTS idx_cards_user_sync_version;
DROP INDEX IF EXISTS idx_cards_user_updated_at;
DROP INDEX IF EXISTS idx_cards_user_folder;
DROP INDEX IF EXISTS idx_cards_user_deleted;
DROP INDEX IF EXISTS idx_cards_user_version_updated;
DROP INDEX IF EXISTS idx_cards_user_updated_version;
DROP INDEX IF EXISTS idx_cards_realtime_subscription;
DROP INDEX IF EXISTS idx_cards_deleted_status;
DROP INDEX IF EXISTS idx_cards_folder_user_composite;
DROP INDEX IF EXISTS idx_cards_user_created_stats;

-- Drop unused indexes for folders table
DROP INDEX IF EXISTS idx_folders_user_order;
DROP INDEX IF EXISTS idx_folders_parent_order;
DROP INDEX IF EXISTS idx_folders_parent_id;
DROP INDEX IF EXISTS idx_folders_user_parent;
DROP INDEX IF EXISTS idx_folders_user_depth;
DROP INDEX IF EXISTS idx_folders_user_updated_at;
DROP INDEX IF EXISTS idx_folders_user_deleted;
DROP INDEX IF EXISTS idx_folders_user_version_updated;
DROP INDEX IF EXISTS idx_folders_user_updated_version;
DROP INDEX IF EXISTS idx_folders_realtime_subscription;
DROP INDEX IF EXISTS idx_folders_full_path;
DROP INDEX IF EXISTS idx_folders_parent_depth;
DROP INDEX IF EXISTS idx_folders_user_parent_depth;
DROP INDEX IF EXISTS idx_folders_hierarchy;
DROP INDEX IF EXISTS idx_folders_deleted_status;
DROP INDEX IF EXISTS idx_folders_user_created_stats;

-- Drop unused indexes for tags table
DROP INDEX IF EXISTS idx_tags_user_updated_at;
DROP INDEX IF EXISTS idx_tags_user_deleted;
DROP INDEX IF EXISTS idx_tags_user_version_updated;
DROP INDEX IF EXISTS idx_tags_realtime_subscription;
DROP INDEX IF EXISTS idx_tags_deleted_status;
DROP INDEX IF EXISTS idx_tags_user_count;

-- Drop unused indexes for images table
DROP INDEX IF EXISTS idx_images_card_id;
DROP INDEX IF EXISTS idx_images_user_card;
DROP INDEX IF EXISTS idx_images_user_updated_at;
DROP INDEX IF EXISTS idx_images_user_deleted;
DROP INDEX IF EXISTS idx_images_realtime_subscription;
DROP INDEX IF EXISTS idx_images_deleted_status;

-- Keep only the essential indexes that are actually used
-- These indexes were created in migration 003 and are optimized for performance