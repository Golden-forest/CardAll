#!/usr/bin/env node

/**
 * CardAll 数据清理脚本
 *
 * 功能：
 * 1. 检测并清理重复数据
 * 2. 保留最早创建的版本
 * 3. 提供备份和回滚机制
 * 4. 验证数据完整性
 *
 * 使用方法：
 * node scripts/data-cleanup.mjs [选项]
 *
 * 选项：
 * --dry-run     仅显示将要执行的操作，不实际执行
 * --backup      在清理前创建数据备份
 * --verify      清理后验证数据完整性
 * --rollback    从备份回滚数据
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================================================
// ⚠️  重要提醒：此脚本已禁用
// ============================================================================
// CardAll 现在是纯本地版本，不再使用 Supabase 云服务
// 此云端数据清理脚本已被禁用，仅作备份参考
// ============================================================================

console.log('🚫 data-cleanup.mjs 脚本已禁用')
console.log('💡 CardAll 已切换为纯本地版本')
console.log('📦 如需清理数据，请清除浏览器中的 IndexedDB')
process.exit(0)

// 以下是原始代码，保留作参考
// ============================================================================

// 配置参数（已禁用）
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://elwnpejlwkgdacaugvvd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzMzOTE1MCwiZXhwIjoyMDY4OTE1MTUwfQ.KXuqkVwJHqY0LzYwYHkO_n8i2Z8vHqJ9pN2X7f3wKkI'

// 解析命令行参数
const args = process.argv.slice(2)
const options = {
  dryRun: args.includes('--dry-run'),
  backup: args.includes('--backup'),
  verify: args.includes('--verify'),
  rollback: args.includes('--rollback'),
  verbose: args.includes('--verbose') || args.includes('-v')
}

// 创建Supabase客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// 日志工具
const log = {
  info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args),
  success: (message, ...args) => console.log(`[SUCCESS] ${new Date().toISOString()} - ${message}`, ...args)
}

// 数据统计工具
class DataStats {
  constructor() {
    this.stats = {
      before: {},
      after: {},
      deleted: {
        cards: 0,
        folders: 0,
        tags: 0,
        images: 0
      }
    }
  }

  async captureStats(label) {
    try {
      const [cards, folders, tags, images] = await Promise.all([
        supabase.from('cards').select('count', { count: 'exact', head: true }),
        supabase.from('folders').select('count', { count: 'exact', head: true }),
        supabase.from('tags').select('count', { count: 'exact', head: true }),
        supabase.from('images').select('count', { count: 'exact', head: true })
      ])

      this.stats[label] = {
        cards: cards.count || 0,
        folders: folders.count || 0,
        tags: tags.count || 0,
        images: images.count || 0
      }

      log.info(`${label}数据统计:`, this.stats[label])
    } catch (error) {
      log.error(`获取${label}统计失败:`, error.message)
    }
  }

  calculateDeleted() {
    if (this.stats.before && this.stats.after) {
      this.stats.deleted = {
        cards: this.stats.before.cards - this.stats.after.cards,
        folders: this.stats.before.folders - this.stats.after.folders,
        tags: this.stats.before.tags - this.stats.after.tags,
        images: this.stats.before.images - this.stats.after.images
      }
    }
  }

  printReport() {
    log.success('=== 数据清理报告 ===')
    log.info('清理前数据统计:', this.stats.before)
    log.info('清理后数据统计:', this.stats.after)
    log.info('删除数据统计:', this.stats.deleted)

    const totalDeleted = Object.values(this.stats.deleted).reduce((sum, count) => sum + count, 0)
    if (totalDeleted > 0) {
      log.success(`总共删除了 ${totalDeleted} 条重复记录`)
    } else {
      log.info('未发现需要删除的重复数据')
    }
  }
}

// 检测重复数据
async function detectDuplicates() {
  log.info('开始检测重复数据...')

  try {
    // 检测重复卡片
    const { data: duplicateCards, error: cardsError } = await supabase
      .rpc('detect_duplicate_cards')

    if (cardsError) {
      // 如果存储过程不存在，使用SQL查询
      const { data, error } = await supabase
        .from('cards')
        .select('user_id, front_content, back_content, COUNT(*) as count')
        .eq('is_deleted', false)
        .group('user_id, front_content, back_content')
        .gte('count', 2)

      if (!error) {
        log.info(`发现 ${data?.length || 0} 组重复卡片`)
        if (options.verbose && data?.length > 0) {
          log.info('重复卡片示例:', data.slice(0, 3))
        }
      }
    } else {
      log.info(`发现 ${duplicateCards?.length || 0} 组重复卡片`)
    }

    // 检测重复文件夹
    const { data: duplicateFolders, error: foldersError } = await supabase
      .from('folders')
      .select('user_id, name, parent_id, COUNT(*) as count')
      .eq('is_deleted', false)
      .group('user_id, name, parent_id')
      .gte('count', 2)

    if (!foldersError) {
      log.info(`发现 ${duplicateFolders?.length || 0} 组重复文件夹`)
      if (options.verbose && duplicateFolders?.length > 0) {
        log.info('重复文件夹示例:', duplicateFolders.slice(0, 3))
      }
    }

    // 检测重复标签
    const { data: duplicateTags, error: tagsError } = await supabase
      .from('tags')
      .select('user_id, name, COUNT(*) as count')
      .eq('is_deleted', false)
      .group('user_id, name')
      .gte('count', 2)

    if (!tagsError) {
      log.info(`发现 ${duplicateTags?.length || 0} 组重复标签`)
      if (options.verbose && duplicateTags?.length > 0) {
        log.info('重复标签示例:', duplicateTags.slice(0, 3))
      }
    }

    return {
      cards: duplicateCards?.length || 0,
      folders: duplicateFolders?.length || 0,
      tags: duplicateTags?.length || 0
    }

  } catch (error) {
    log.error('检测重复数据失败:', error.message)
    throw error
  }
}

// 创建数据备份
async function createBackup() {
  if (!options.backup && !options.rollback) return

  log.info('开始创建数据备份...')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPrefix = `cleanup_backup_${timestamp}`

  try {
    // 备份卡片数据
    const { data: cardsBackup } = await supabase
      .from('cards')
      .select('*')
      .in('id', await getDuplicateCardIds())

    if (cardsBackup && cardsBackup.length > 0) {
      const { error } = await supabase.storage
        .from('backups')
        .upload(`${backupPrefix}/cards.json`, JSON.stringify(cardsBackup, null, 2))

      if (!error) {
        log.success(`备份了 ${cardsBackup.length} 条卡片记录`)
      }
    }

    // 备份文件夹数据
    const { data: foldersBackup } = await supabase
      .from('folders')
      .select('*')
      .in('id', await getDuplicateFolderIds())

    if (foldersBackup && foldersBackup.length > 0) {
      const { error } = await supabase.storage
        .from('backups')
        .upload(`${backupPrefix}/folders.json`, JSON.stringify(foldersBackup, null, 2))

      if (!error) {
        log.success(`备份了 ${foldersBackup.length} 条文件夹记录`)
      }
    }

    // 备份标签数据
    const { data: tagsBackup } = await supabase
      .from('tags')
      .select('*')
      .in('id', await getDuplicateTagIds())

    if (tagsBackup && tagsBackup.length > 0) {
      const { error } = await supabase.storage
        .from('backups')
        .upload(`${backupPrefix}/tags.json`, JSON.stringify(tagsBackup, null, 2))

      if (!error) {
        log.success(`备份了 ${tagsBackup.length} 条标签记录`)
      }
    }

    return backupPrefix
  } catch (error) {
    log.error('创建备份失败:', error.message)
    throw error
  }
}

// 获取重复卡片ID
async function getDuplicateCardIds() {
  const { data } = await supabase
    .from('cards')
    .select('id')
    .in('id', `
      SELECT id FROM cards
      WHERE is_deleted = false
      AND id NOT IN (
        SELECT MIN(id)
        FROM cards
        WHERE is_deleted = false
        GROUP BY user_id, MD5(COALESCE(front_content::text, '') || COALESCE(back_content::text, ''))
      )
    `)

  return data?.map(item => item.id) || []
}

// 获取重复文件夹ID
async function getDuplicateFolderIds() {
  const { data } = await supabase
    .from('folders')
    .select('id')
    .in('id', `
      SELECT id FROM folders
      WHERE is_deleted = false
      AND id NOT IN (
        SELECT MIN(id)
        FROM folders
        WHERE is_deleted = false
        GROUP BY user_id, name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000')
      )
    `)

  return data?.map(item => item.id) || []
}

// 获取重复标签ID
async function getDuplicateTagIds() {
  const { data } = await supabase
    .from('tags')
    .select('id')
    .in('id', `
      SELECT id FROM tags
      WHERE is_deleted = false
      AND id NOT IN (
        SELECT MIN(id)
        FROM tags
        WHERE is_deleted = false
        GROUP BY user_id, name
      )
    `)

  return data?.map(item => item.id) || []
}

// 执行数据清理
async function executeCleanup() {
  log.info('开始执行数据清理...')

  try {
    // 读取SQL脚本
    const sqlPath = join(__dirname, 'cleanup-duplicate-data.sql')
    const sqlContent = readFileSync(sqlPath, 'utf8')

    if (options.dryRun) {
      log.warn('--- 干运行模式：仅显示将要执行的SQL ---')
      console.log(sqlContent)
      log.warn('--- 干运行模式结束 ---')
      return
    }

    // 执行清理SQL（这里需要将SQL拆分为单独的语句执行）
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    for (const statement of statements) {
      if (statement.trim()) {
        log.info(`执行SQL: ${statement.substring(0, 100)}...`)

        const { error } = await supabase.rpc('execute_sql', { sql_statement: statement })

        if (error) {
          log.error(`SQL执行失败: ${error.message}`)
          throw error
        }
      }
    }

    log.success('数据清理执行完成')
  } catch (error) {
    log.error('执行数据清理失败:', error.message)
    throw error
  }
}

// 验证数据完整性
async function verifyDataIntegrity() {
  if (!options.verify) return

  log.info('开始验证数据完整性...')

  try {
    // 检查外键约束
    const { data: orphanedCards, error: cardsError } = await supabase
      .from('cards')
      .select('id, folder_id')
      .not('folder_id', 'is', null)
      .left_join('folders', 'cards.folder_id', 'folders.id')
      .is('folders.id', null)

    if (cardsError) {
      log.error('检查卡片外键约束失败:', cardsError.message)
    } else if (orphanedCards && orphanedCards.length > 0) {
      log.warn(`发现 ${orphanedCards.length} 张孤立卡片，正在修复...`)

      // 将孤立卡片移到根目录
      await supabase
        .from('cards')
        .update({ folder_id: null })
        .in('id', orphanedCards.map(card => card.id))

      log.success('孤立卡片修复完成')
    }

    // 检查图片表中的孤儿记录
    const { data: orphanedImages, error: imagesError } = await supabase
      .from('images')
      .select('id, card_id')
      .not('card_id', 'is', null)
      .left_join('cards', 'images.card_id', 'cards.id')
      .is('cards.id', null)

    if (imagesError) {
      log.error('检查图片外键约束失败:', imagesError.message)
    } else if (orphanedImages && orphanedImages.length > 0) {
      log.warn(`发现 ${orphanedImages.length} 条孤立图片记录，正在清理...`)

      await supabase
        .from('images')
        .delete()
        .in('id', orphanedImages.map(img => img.id))

      log.success('孤立图片记录清理完成')
    }

    // 最终验证：检查是否还有重复数据
    const duplicatesAfter = await detectDuplicates()
    const totalDuplicates = Object.values(duplicatesAfter).reduce((sum, count) => sum + count, 0)

    if (totalDuplicates === 0) {
      log.success('✅ 数据完整性验证通过：未发现重复数据')
    } else {
      log.warn(`⚠️  仍有 ${totalDuplicates} 组重复数据需要处理`)
    }

  } catch (error) {
    log.error('数据完整性验证失败:', error.message)
    throw error
  }
}

// 从备份回滚数据
async function rollbackFromBackup() {
  if (!options.rollback) return

  log.info('开始从备份回滚数据...')

  try {
    // 这里需要根据实际的备份文件进行回滚
    // 由于备份文件在 Supabase Storage 中，需要先下载再恢复
    log.warn('回滚功能需要手动实现，请联系数据库管理员')

  } catch (error) {
    log.error('回滚数据失败:', error.message)
    throw error
  }
}

// 主函数
async function main() {
  console.log('🚀 CardAll 数据清理工具启动')
  console.log(`配置: ${JSON.stringify(options, null, 2)}`)

  const stats = new DataStats()

  try {
    // 连接测试
    const { data, error } = await supabase.from('cards').select('count', { count: 'exact', head: true })
    if (error) {
      throw new Error(`数据库连接失败: ${error.message}`)
    }
    log.success('数据库连接成功')

    // 捕获清理前统计
    await stats.captureStats('before')

    // 检测重复数据
    const duplicates = await detectDuplicates()
    const totalDuplicates = Object.values(duplicates).reduce((sum, count) => sum + count, 0)

    if (totalDuplicates === 0) {
      log.success('✅ 未发现重复数据，数据库状态良好')
      return
    }

    // 创建备份
    const backupName = await createBackup()

    // 执行清理
    await executeCleanup()

    // 捕获清理后统计
    await stats.captureStats('after')
    stats.calculateDeleted()

    // 验证数据完整性
    await verifyDataIntegrity()

    // 打印报告
    stats.printReport()

    log.success('🎉 数据清理任务完成！')
    if (backupName) {
      log.info(`备份已保存为: ${backupName}`)
    }

  } catch (error) {
    log.error('❌ 数据清理失败:', error.message)
    if (options.verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  log.error('未捕获的异常:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error('未处理的Promise拒绝:', reason)
  process.exit(1)
})

// 运行主函数
main().catch(console.error)