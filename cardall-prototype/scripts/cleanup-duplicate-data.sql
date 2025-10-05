-- ====================================================================
-- CardAll 重复数据清理脚本
-- ====================================================================
-- 目的：清理数据库中的重复数据，保留最早创建的版本
-- 执行前请务必备份数据库
-- ====================================================================

-- 创建备份表（用于回滚）
CREATE TABLE IF NOT EXISTS cards_backup AS
SELECT * FROM cards WHERE id IN (
    SELECT MIN(id) FROM cards GROUP BY user_id, front_content, back_content
    HAVING COUNT(*) > 1
);

CREATE TABLE IF NOT EXISTS folders_backup AS
SELECT * FROM folders WHERE id IN (
    SELECT MIN(id) FROM folders GROUP BY user_id, name, parent_id
    HAVING COUNT(*) > 1
);

CREATE TABLE IF NOT EXISTS tags_backup AS
SELECT * FROM tags WHERE id IN (
    SELECT MIN(id) FROM tags GROUP BY user_id, name
    HAVING COUNT(*) > 1
);

-- ====================================================================
-- 1. 清理重复卡片数据
-- ====================================================================

-- 识别重复卡片（相同内容的卡片，保留最早创建的）
WITH duplicate_cards AS (
    SELECT
        id,
        user_id,
        front_content,
        back_content,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY user_id,
            MD5(COALESCE(front_content::text, '') || COALESCE(back_content::text, ''))
            ORDER BY created_at ASC, id ASC
        ) AS row_num
    FROM cards
    WHERE is_deleted = false
),
cards_to_delete AS (
    SELECT id FROM duplicate_cards WHERE row_num > 1
)

-- 显示将要删除的重复卡片数量
SELECT '重复卡片数量' as operation, COUNT(*) as count
FROM cards_to_delete;

-- 删除重复卡片（保留最早创建的）
DELETE FROM cards
WHERE id IN (SELECT id FROM cards_to_delete);

-- 更新相关images表，删除孤立图片记录
DELETE FROM images
WHERE card_id NOT IN (SELECT id FROM cards WHERE is_deleted = false);

-- ====================================================================
-- 2. 清理重复文件夹数据
-- ====================================================================

-- 识别重复文件夹（相同用户、相同名称、相同父级的文件夹）
WITH duplicate_folders AS (
    SELECT
        id,
        user_id,
        name,
        parent_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000')
            ORDER BY created_at ASC, id ASC
        ) AS row_num
    FROM folders
    WHERE is_deleted = false
),
folders_to_delete AS (
    SELECT id FROM duplicate_folders WHERE row_num > 1
)

-- 显示将要删除的重复文件夹数量
SELECT '重复文件夹数量' as operation, COUNT(*) as count
FROM folders_to_delete;

-- 更新被删除文件夹中的卡片，将其移动到根目录
UPDATE cards
SET folder_id = NULL
WHERE folder_id IN (SELECT id FROM folders_to_delete);

-- 删除重复文件夹
DELETE FROM folders
WHERE id IN (SELECT id FROM folders_to_delete);

-- ====================================================================
-- 3. 清理重复标签数据
-- ====================================================================

-- 识别重复标签（相同用户、相同名称的标签）
WITH duplicate_tags AS (
    SELECT
        id,
        user_id,
        name,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, name
            ORDER BY created_at ASC, id ASC
        ) AS row_num
    FROM tags
    WHERE is_deleted = false
),
tags_to_delete AS (
    SELECT id FROM duplicate_tags WHERE row_num > 1
)

-- 显示将要删除的重复标签数量
SELECT '重复标签数量' as operation, COUNT(*) as count
FROM tags_to_delete;

-- 删除重复标签
DELETE FROM tags
WHERE id IN (SELECT id FROM tags_to_delete);

-- ====================================================================
-- 4. 清理已标记删除但可以安全删除的数据
-- ====================================================================

-- 清理超过30天的已删除卡片
DELETE FROM cards
WHERE is_deleted = true
AND updated_at < NOW() - INTERVAL '30 days';

-- 清理超过30天的已删除文件夹
DELETE FROM folders
WHERE is_deleted = true
AND updated_at < NOW() - INTERVAL '30 days';

-- 清理超过30天的已删除标签
DELETE FROM tags
WHERE is_deleted = true
AND updated_at < NOW() - INTERVAL '30 days';

-- ====================================================================
-- 5. 更新统计信息和索引
-- ====================================================================

-- 更新表统计信息
ANALYZE cards;
ANALYZE folders;
ANALYZE tags;
ANALYZE images;

-- 重建索引以提高性能
REINDEX INDEX CONCURRENTLY idx_cards_user_id;
REINDEX INDEX CONCURRENTLY idx_cards_folder_id;
REINDEX INDEX CONCURRENTLY idx_cards_updated_at;
REINDEX INDEX CONCURRENTLY idx_folders_user_id;
REINDEX INDEX CONCURRENTLY idx_folders_parent_id;
REINDEX INDEX CONCURRENTLY idx_tags_user_id;

-- ====================================================================
-- 6. 验证清理结果
-- ====================================================================

-- 显示清理后的数据统计
SELECT '清理后统计' as operation,
       (SELECT COUNT(*) FROM cards WHERE is_deleted = false) as cards_count,
       (SELECT COUNT(*) FROM folders WHERE is_deleted = false) as folders_count,
       (SELECT COUNT(*) FROM tags WHERE is_deleted = false) as tags_count,
       (SELECT COUNT(*) FROM images) as images_count;

-- 检查是否还存在重复数据
SELECT '卡片重复检查' as operation,
       COUNT(*) as duplicate_count
FROM cards
WHERE is_deleted = false
AND id NOT IN (
    SELECT MIN(id)
    FROM cards
    WHERE is_deleted = false
    GROUP BY user_id, MD5(COALESCE(front_content::text, '') || COALESCE(back_content::text, ''))
);

SELECT '文件夹重复检查' as operation,
       COUNT(*) as duplicate_count
FROM folders
WHERE is_deleted = false
AND id NOT IN (
    SELECT MIN(id)
    FROM folders
    WHERE is_deleted = false
    GROUP BY user_id, name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000')
);

SELECT '标签重复检查' as operation,
       COUNT(*) as duplicate_count
FROM tags
WHERE is_deleted = false
AND id NOT IN (
    SELECT MIN(id)
    FROM tags
    WHERE is_deleted = false
    GROUP BY user_id, name
);

-- ====================================================================
-- 清理完成
-- ====================================================================

SELECT '数据清理完成' as status, NOW() as completed_at;

-- 创建清理报告
SELECT
    '备份表记录数' as report_type,
    (SELECT COUNT(*) FROM cards_backup) as cards_backup_count,
    (SELECT COUNT(*) FROM folders_backup) as folders_backup_count,
    (SELECT COUNT(*) FROM tags_backup) as tags_backup_count;

-- 提示：如果需要回滚，可以使用以下语句：
-- INSERT INTO cards SELECT * FROM cards_backup;
-- INSERT INTO folders SELECT * FROM folders_backup;
-- INSERT INTO tags SELECT * FROM tags_backup;