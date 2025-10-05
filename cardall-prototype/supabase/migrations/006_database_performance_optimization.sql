-- CardAll 数据库性能优化方案
-- 版本: 1.0
-- 日期: 2025-09-28
-- 描述: 优化同步性能和数据一致性的综合方案

-- ============================================================================
-- 1. 核心索引优化
-- ============================================================================

-- 为卡片表创建复合索引，优化常见查询模式
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_composite_sync
ON cards(user_id, sync_version, updated_at)
WHERE is_deleted = false;

-- 优化按文件夹和用户查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_user_folder_updated
ON cards(user_id, folder_id, updated_at DESC)
WHERE is_deleted = false;

-- 为全文搜索优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_search_vector
ON cards USING GIN(to_tsvector('english',
    COALESCE(front_content->>'title', '') || ' ' ||
    COALESCE(front_content->>'text', '') || ' ' ||
    COALESCE(back_content->>'title', '') || ' ' ||
    COALESCE(back_content->>'text', '')
));

-- 为同步操作优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_pending_sync
ON cards(sync_version, pending_sync, user_id)
WHERE is_deleted = false AND pending_sync = true;

-- ============================================================================
-- 2. 文件夹索引优化
-- ============================================================================

-- 文件夹层级查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folders_hierarchy
ON folders(user_id, parent_id, depth, order_index)
WHERE is_deleted = false;

-- 文件夹路径优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folders_full_path
ON folders(user_id, full_path)
WHERE is_deleted = false;

-- 文件夹同步优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folders_sync_priority
ON folders(sync_version, pending_sync, user_id)
WHERE is_deleted = false;

-- ============================================================================
-- 3. 标签索引优化
-- ============================================================================

-- 标签名称和用户组合查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_user_name_unique
ON tags(user_id, name)
WHERE is_deleted = false;

-- 标签使用频率统计
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_usage_stats
ON tags(count, updated_at)
WHERE is_deleted = false;

-- 标签同步优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_sync_optimization
ON tags(sync_version, pending_sync, user_id)
WHERE is_deleted = false;

-- ============================================================================
-- 4. 图片索引优化
-- ============================================================================

-- 图片按卡片和用户查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_card_user_storage
ON images(card_id, user_id, storage_mode)
WHERE is_deleted = false;

-- 图片存储优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_storage_optimization
ON images(storage_mode, created_at)
WHERE is_deleted = false;

-- 图片同步优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_sync_batch
ON images(sync_version, pending_sync, user_id)
WHERE is_deleted = false;

-- ============================================================================
-- 5. 同步元数据表优化
-- ============================================================================

-- 创建同步元数据表（如果不存在）
CREATE TABLE IF NOT EXISTS sync_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('card', 'folder', 'tag', 'image')),
    entity_id UUID NOT NULL,
    sync_version BIGINT NOT NULL DEFAULT 1,
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    conflict_hash VARCHAR(64), -- 用于冲突检测的数据哈希
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 复合唯一约束
    UNIQUE(user_id, entity_type, entity_id)
);

-- 同步元数据索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_metadata_user_entity
ON sync_metadata(user_id, entity_type, entity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_metadata_sync_status
ON sync_metadata(sync_status, last_sync_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_metadata_conflict_detection
ON sync_metadata(conflict_hash, sync_version);

-- ============================================================================
-- 6. 性能监控表
-- ============================================================================

-- 查询性能监控表
CREATE TABLE IF NOT EXISTS query_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    query_type VARCHAR(50) NOT NULL,
    query_text TEXT,
    execution_time BIGINT NOT NULL, -- 毫秒
    rows_affected INTEGER,
    index_used VARCHAR(100),
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 性能日志索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_perf_user_type
ON query_performance_logs(user_id, query_type, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_perf_slow_queries
ON query_performance_logs(execution_time) WHERE execution_time > 1000;

-- ============================================================================
-- 7. 数据一致性验证表
-- ============================================================================

-- 数据校验和表
CREATE TABLE IF NOT EXISTS data_checksums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('card', 'folder', 'tag', 'image')),
    entity_id UUID NOT NULL,
    checksum VARCHAR(64) NOT NULL, -- SHA-256哈希
    version BIGINT NOT NULL,
    last_verified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_consistent BOOLEAN DEFAULT TRUE,

    UNIQUE(user_id, entity_type, entity_id)
);

-- 校验和索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checksums_user_entity
ON data_checksums(user_id, entity_type, entity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checksums_consistency
ON data_checksums(is_consistent, last_verified);

-- ============================================================================
-- 8. 批量操作优化表
-- ============================================================================

-- 批量操作队列表
CREATE TABLE IF NOT EXISTS batch_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) NOT NULL,
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('card', 'folder', 'tag', 'image')),
    entity_data JSONB,
    priority INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    INDEX(user_id, batch_id, status)
);

-- 批量操作索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_operations_user_priority
ON batch_operations(user_id, priority, status, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_operations_batch_status
ON batch_operations(batch_id, status);

-- ============================================================================
-- 9. 触发器优化
-- ============================================================================

-- 自动更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表添加自动更新触发器
DO $$
BEGIN
    FOR table_name IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('cards', 'folders', 'tags', 'images', 'sync_metadata', 'data_checksums', 'batch_operations')
    LOOP
        EXECUTE format('CREATE TRIGGER update_%s_updated_at
                        BEFORE UPDATE ON %s
                        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
                        table_name, table_name);
    END LOOP;
END $$;

-- 自动生成冲突哈希触发器
CREATE OR REPLACE FUNCTION generate_conflict_hash()
RETURNS TRIGGER AS $$
BEGIN
    -- 为卡片生成冲突哈希
    IF TG_TABLE_NAME = 'cards' THEN
        NEW.conflict_hash = encode(digest(
            COALESCE(NEW.front_content::text, '') ||
            COALESCE(NEW.back_content::text, '') ||
            COALESCE(NEW.style::text, '') ||
            COALESCE(NEW.folder_id, ''),
            'sha256'
        ), 'hex');
    END IF;

    -- 为文件夹生成冲突哈希
    IF TG_TABLE_NAME = 'folders' THEN
        NEW.conflict_hash = encode(digest(
            COALESCE(NEW.name, '') ||
            COALESCE(NEW.parent_id, '') ||
            COALESCE(NEW.full_path, ''),
            'sha256'
        ), 'hex');
    END IF;

    -- 为标签生成冲突哈希
    IF TG_TABLE_NAME = 'tags' THEN
        NEW.conflict_hash = encode(digest(
            COALESCE(NEW.name, '') ||
            COALESCE(NEW.color, ''),
            'sha256'
        ), 'hex');
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- 添加冲突哈希触发器
CREATE TRIGGER generate_cards_conflict_hash
    BEFORE INSERT OR UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION generate_conflict_hash();

CREATE TRIGGER generate_folders_conflict_hash
    BEFORE INSERT OR UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION generate_conflict_hash();

CREATE TRIGGER generate_tags_conflict_hash
    BEFORE INSERT OR UPDATE ON tags
    FOR EACH ROW EXECUTE FUNCTION generate_conflict_hash();

-- ============================================================================
-- 10. 存储过程和函数优化
-- ============================================================================

-- 高效的增量同步函数
CREATE OR REPLACE FUNCTION get_incremental_changes(
    p_user_id UUID,
    p_last_sync TIMESTAMPTZ,
    p_entity_types TEXT[] DEFAULT ARRAY['card', 'folder', 'tag', 'image']
)
RETURNS TABLE (
    entity_type TEXT,
    entity_id UUID,
    operation VARCHAR(10),
    data JSONB,
    sync_version BIGINT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH all_changes AS (
        -- 卡片变更
        SELECT 'card' as entity_type, id as entity_id,
               CASE WHEN created_at > p_last_sync THEN 'insert' ELSE 'update' END as operation,
               jsonb_build_object(
                   'front_content', front_content,
                   'back_content', back_content,
                   'style', style,
                   'folder_id', folder_id
               ) as data,
               sync_version, updated_at
        FROM cards
        WHERE user_id = p_user_id
          AND updated_at > p_last_sync
          AND is_deleted = false

        UNION ALL

        -- 文件夹变更
        SELECT 'folder' as entity_type, id as entity_id,
               CASE WHEN created_at > p_last_sync THEN 'insert' ELSE 'update' END as operation,
               jsonb_build_object(
                   'name', name,
                   'parent_id', parent_id,
                   'full_path', full_path
               ) as data,
               sync_version, updated_at
        FROM folders
        WHERE user_id = p_user_id
          AND updated_at > p_last_sync
          AND is_deleted = false

        UNION ALL

        -- 标签变更
        SELECT 'tag' as entity_type, id as entity_id,
               CASE WHEN created_at > p_last_sync THEN 'insert' ELSE 'update' END as operation,
               jsonb_build_object(
                   'name', name,
                   'color', color
               ) as data,
               sync_version, updated_at
        FROM tags
        WHERE user_id = p_user_id
          AND updated_at > p_last_sync
          AND is_deleted = false

        UNION ALL

        -- 图片变更
        SELECT 'image' as entity_type, id as entity_id,
               CASE WHEN created_at > p_last_sync THEN 'insert' ELSE 'update' END as operation,
               jsonb_build_object(
                   'file_name', file_name,
                   'file_path', file_path,
                   'cloud_url', cloud_url,
                   'storage_mode', storage_mode
               ) as data,
               sync_version, updated_at
        FROM images
        WHERE user_id = p_user_id
          AND updated_at > p_last_sync
          AND is_deleted = false
    )
    SELECT * FROM all_changes
    WHERE entity_type = ANY(p_entity_types)
    ORDER BY updated_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 批量插入优化函数
CREATE OR REPLACE FUNCTION batch_insert_cards(
    p_cards JSONB[]
)
RETURNS TABLE (
    id UUID,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_card JSONB;
    v_id UUID;
    v_success BOOLEAN;
    v_error TEXT;
BEGIN
    FOREACH v_card IN ARRAY p_cards
    LOOP
        BEGIN
            INSERT INTO cards (
                id, user_id, front_content, back_content, style, folder_id,
                sync_version, pending_sync, created_at, updated_at
            ) VALUES (
                COALESCE(v_card->>'id', gen_random_uuid()),
                v_card->>'user_id',
                v_card->'front_content',
                v_card->'back_content',
                v_card->'style',
                v_card->>'folder_id',
                COALESCE((v_card->>'sync_version')::BIGINT, 1),
                COALESCE((v_card->>'pending_sync')::BOOLEAN, TRUE),
                COALESCE((v_card->>'created_at')::TIMESTAMPTZ, NOW()),
                COALESCE((v_card->>'updated_at')::TIMESTAMPTZ, NOW())
            )
            ON CONFLICT (id) DO UPDATE SET
                front_content = EXCLUDED.front_content,
                back_content = EXCLUDED.back_content,
                style = EXCLUDED.style,
                folder_id = EXCLUDED.folder_id,
                sync_version = EXCLUDED.sync_version + 1,
                pending_sync = EXCLUDED.pending_sync,
                updated_at = NOW();

            v_id = COALESCE(v_card->>'id', gen_random_uuid());
            v_success := TRUE;
            v_error := NULL;

        EXCEPTION WHEN OTHERS THEN
            v_id := NULL;
            v_success := FALSE;
            v_error := SQLERRM;
        END;

        RETURN NEXT VALUES (v_id, v_success, v_error);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 冲突检测优化函数
CREATE OR REPLACE FUNCTION detect_sync_conflicts(
    p_user_id UUID,
    p_local_data JSONB,
    p_entity_type TEXT
)
RETURNS TABLE (
    entity_id UUID,
    conflict_type TEXT,
    local_version BIGINT,
    remote_version BIGINT,
    conflict_details JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH remote_data AS (
        SELECT id, sync_version, conflict_hash,
               CASE
                   WHEN p_entity_type = 'card' THEN jsonb_build_object(
                       'front_content', front_content,
                       'back_content', back_content,
                       'style', style,
                       'folder_id', folder_id
                   )
                   WHEN p_entity_type = 'folder' THEN jsonb_build_object(
                       'name', name,
                       'parent_id', parent_id,
                       'full_path', full_path
                   )
                   WHEN p_entity_type = 'tag' THEN jsonb_build_object(
                       'name', name,
                       'color', color
                   )
                   ELSE NULL
               END as data
        FROM CASE
            WHEN p_entity_type = 'card' THEN cards
            WHEN p_entity_type = 'folder' THEN folders
            WHEN p_entity_type = 'tag' THEN tags
            ELSE NULL
        END
        WHERE user_id = p_user_id AND id = (p_local_data->>'id')::UUID
    )
    SELECT
        r.id as entity_id,
        CASE
            WHEN r.conflict_hash IS NULL THEN 'missing_remote'
            WHEN l.sync_version > r.sync_version THEN 'local_newer'
            WHEN r.sync_version > l.sync_version THEN 'remote_newer'
            WHEN r.conflict_hash != l.conflict_hash THEN 'concurrent_modification'
            ELSE 'no_conflict'
        END as conflict_type,
        l.sync_version as local_version,
        COALESCE(r.sync_version, 0) as remote_version,
        jsonb_build_object(
            'local_data', l.data,
            'remote_data', r.data,
            'local_hash', l.conflict_hash,
            'remote_hash', r.conflict_hash
        ) as conflict_details
    FROM jsonb_array_elements(p_local_data) as l(data, sync_version, conflict_hash)
    LEFT JOIN remote_data r ON r.id = (l.data->>'id')::UUID
    WHERE r.conflict_hash IS NULL
       OR l.sync_version != r.sync_version
       OR l.conflict_hash != r.conflict_hash;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. 性能监控视图
-- ============================================================================

-- 创建同步性能监控视图
CREATE OR REPLACE VIEW sync_performance_stats AS
SELECT
    user_id,
    entity_type,
    COUNT(*) as total_operations,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_sync_time_ms,
    MAX(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as max_sync_time_ms,
    MIN(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as min_sync_time_ms,
    COUNT(CASE WHEN sync_status = 'completed' THEN 1 END) as successful_operations,
    COUNT(CASE WHEN sync_status = 'error' THEN 1 END) as failed_operations,
    COUNT(CASE WHEN sync_status = 'conflict' THEN 1 END) as conflict_operations
FROM sync_metadata
GROUP BY user_id, entity_type;

-- 创建索引使用统计视图
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname::regclass)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('cards', 'folders', 'tags', 'images', 'sync_metadata', 'data_checksums', 'batch_operations')
ORDER BY idx_scan DESC;

-- 创建数据一致性监控视图
CREATE OR REPLACE VIEW data_consistency_stats AS
SELECT
    user_id,
    entity_type,
    COUNT(*) as total_entities,
    COUNT(CASE WHEN is_consistent = TRUE THEN 1 END) as consistent_entities,
    COUNT(CASE WHEN is_consistent = FALSE THEN 1 END) as inconsistent_entities,
    ROUND(COUNT(CASE WHEN is_consistent = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as consistency_percentage,
    MAX(last_verified) as last_verification
FROM data_checksums
GROUP BY user_id, entity_type;

-- ============================================================================
-- 12. 权限设置
-- ============================================================================

-- 为性能监控视图设置权限
GRANT SELECT ON sync_performance_stats TO authenticated;
GRANT SELECT ON index_usage_stats TO authenticated;
GRANT SELECT ON data_consistency_stats TO authenticated;

-- 为新表设置RLS策略
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_checksums ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_operations ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "Users can view own sync metadata" ON sync_metadata
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync metadata" ON sync_metadata
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync metadata" ON sync_metadata
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own query logs" ON query_performance_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own query logs" ON query_performance_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own checksums" ON data_checksums
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checksums" ON data_checksums
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checksums" ON data_checksums
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own batch operations" ON batch_operations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own batch operations" ON batch_operations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own batch operations" ON batch_operations
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 13. 维护任务
-- ============================================================================

-- 创建维护函数
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 删除30天前的查询性能日志
    DELETE FROM query_performance_logs
    WHERE created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- 清理旧的批量操作记录
    DELETE FROM batch_operations
    WHERE status = 'completed'
      AND updated_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    -- 清理旧的同步元数据
    DELETE FROM sync_metadata
    WHERE last_sync_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建索引重建函数
CREATE OR REPLACE FUNCTION rebuild_indexes()
RETURNS INTEGER AS $$
DECLARE
    rebuild_count INTEGER := 0;
BEGIN
    -- 重建常用索引
    PERFORM pg_reindex('idx_cards_composite_sync');
    rebuild_count := rebuild_count + 1;

    PERFORM pg_reindex('idx_cards_user_folder_updated');
    rebuild_count := rebuild_count + 1;

    PERFORM pg_reindex('idx_folders_hierarchy');
    rebuild_count := rebuild_count + 1;

    PERFORM pg_reindex('idx_tags_user_name_unique');
    rebuild_count := rebuild_count + 1;

    PERFORM pg_reindex('idx_images_card_user_storage');
    rebuild_count := rebuild_count + 1;

    RETURN rebuild_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 14. 注释和文档
-- ============================================================================

COMMENT ON TABLE sync_metadata IS '同步元数据表，用于跟踪实体同步状态和版本信息';
COMMENT ON TABLE query_performance_logs IS '查询性能日志表，用于监控和分析查询性能';
COMMENT ON TABLE data_checksums IS '数据校验和表，用于确保数据一致性';
COMMENT ON TABLE batch_operations IS '批量操作队列表，用于优化批量数据操作';

COMMENT ON FUNCTION get_incremental_changes(UUID, TIMESTAMPTZ, TEXT[]) IS '获取指定时间后的增量变更数据';
COMMENT ON FUNCTION batch_insert_cards(JSONB[]) IS '批量插入卡片数据，优化性能';
COMMENT ON FUNCTION detect_sync_conflicts(UUID, JSONB, TEXT) IS '检测同步冲突，返回冲突详情';

-- 完成优化
SELECT 'Database optimization completed successfully' as status;