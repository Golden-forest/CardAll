#!/usr/bin/env node

/**
 * 安全清理脚本
 * 基于依赖关系分析结果，安全地删除冗余代码
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SERVICES_DIR = __dirname
const BACKUP_DIR = path.join(SERVICES_DIR, '__cleanup_backup__')

// 创建备份目录
function createBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`)
  fs.mkdirSync(backupPath, { recursive: true })

  return backupPath
}

// 备份文件
function backupFile(filePath, backupPath) {
  const relativePath = path.relative(SERVICES_DIR, filePath)
  const backupFilePath = path.join(backupPath, relativePath)

  // 确保目标目录存在
  const backupDir = path.dirname(backupFilePath)
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  fs.copyFileSync(filePath, backupFilePath)
  console.log(`✅ 备份: ${relativePath}`)
}

// 加载分析结果
function loadAnalysisResult() {
  const analysisPath = path.join(SERVICES_DIR, 'cleanup-analysis-result.json')
  if (!fs.existsSync(analysisPath)) {
    console.error('❌ 找不到分析结果文件，请先运行 cleanup-analysis.mjs')
    process.exit(1)
  }

  return JSON.parse(fs.readFileSync(analysisPath, 'utf8'))
}

// 检查系统健康状态
function checkSystemHealth() {
  console.log('🔍 检查系统健康状态...')

  const criticalFiles = [
    'database.ts',
    'auth.ts',
    'simple-sync-service.ts',
    'supabase.ts',
    'error-handler.ts'
  ]

  const missingFiles = []
  for (const file of criticalFiles) {
    const filePath = path.join(SERVICES_DIR, file)
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file)
    }
  }

  if (missingFiles.length > 0) {
    console.error('❌ 发现缺失的关键文件:', missingFiles.join(', '))
    return false
  }

  console.log('✅ 关键文件检查通过')
  return true
}

// 检查依赖关系是否健康
function checkDependencyHealth(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')

    // 检查是否有import缺失
    const imports = content.match(/import.*from\s+['"`]([^'"`]+)['"`]/g) || []

    for (const importStatement of imports) {
      const match = importStatement.match(/from\s+['"`]([^'"`]+)['"`]/)
      if (match) {
        const importPath = match[1]

        if (importPath.startsWith('./') || importPath.startsWith('../')) {
          const resolvedPath = path.resolve(path.dirname(filePath), importPath)

          // 尝试不同的文件扩展名
          const possiblePaths = [
            resolvedPath,
            resolvedPath + '.ts',
            resolvedPath + '.js',
            path.join(resolvedPath, 'index.ts'),
            path.join(resolvedPath, 'index.js')
          ]

          const exists = possiblePaths.some(p => fs.existsSync(p))
          if (!exists) {
            console.warn(`⚠️  可能的broken import: ${importStatement} in ${path.relative(SERVICES_DIR, filePath)}`)
          }
        }
      }
    }

    return true
  } catch (error) {
    console.error(`❌ 检查文件失败 ${filePath}:`, error.message)
    return false
  }
}

// 安全删除文件
function safeDeleteFile(filePath, backupPath) {
  const relativePath = path.relative(SERVICES_DIR, filePath)

  console.log(`🗑️  准备删除: ${relativePath}`)

  // 备份文件
  backupFile(filePath, backupPath)

  // 删除文件
  fs.unlinkSync(filePath)
  console.log(`✅ 已删除: ${relativePath}`)

  return true
}

// 修复导入语句
function fixImportsInFile(filePath, deletedFiles) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    let modified = false

    // 移除对已删除文件的import
    for (const deletedFile of deletedFiles) {
      const baseName = path.basename(deletedFile, '.ts')

      // 移除相关import语句
      const importPatterns = [
        new RegExp(`import\\s+.*?${baseName}.*?from\\s+['"\`](.*?${deletedFile}.*?)['"\`];?\\s*\\n`, 'g'),
        new RegExp(`import\\s+\\{[^}]*${baseName}[^}]*\\}\\s+from\\s+['"\`](.*?${deletedFile}.*?)['"\`];?\\s*\\n`, 'g'),
        new RegExp(`import\\s+.*?from\\s+['"\`](.*?${deletedFile}.*?)['"\`];?\\s*\\n`, 'g')
      ]

      for (const pattern of importPatterns) {
        if (pattern.test(content)) {
          content = content.replace(pattern, '')
          modified = true
          console.log(`🔧 移除import: ${baseName} from ${path.relative(SERVICES_DIR, filePath)}`)
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content)
      return true
    }

    return false
  } catch (error) {
    console.error(`❌ 修复导入失败 ${filePath}:`, error.message)
    return false
  }
}

// 批量修复依赖
function fixDependencies(deletedFiles) {
  console.log('🔧 修复依赖关系...')

  const allFiles = getAllTypeScriptFiles(SERVICES_DIR)
  let fixedCount = 0

  for (const file of allFiles) {
    if (fixImportsInFile(file, deletedFiles)) {
      fixedCount++
    }
  }

  console.log(`✅ 修复了 ${fixedCount} 个文件的依赖关系`)
}

// 获取所有TypeScript文件
function getAllTypeScriptFiles(dir) {
  const files = []

  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir)

      for (const item of items) {
        const fullPath = path.join(currentDir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory() && !item.startsWith('.') && !item.startsWith('__')) {
          traverse(fullPath)
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // 忽略无法读取的目录
    }
  }

  traverse(dir)
  return files
}

// 执行删除
async function performCleanup(analysisResult, backupPath) {
  console.log('🚀 开始安全清理...\n')

  // 按风险级别分组
  const { plan } = analysisResult
  const deletedFiles = []

  // 第一阶段：删除安全文件
  console.log('📋 第一阶段：删除安全文件')
  for (const { file } of plan.safeToDelete) {
    const filePath = path.join(SERVICES_DIR, file)
    if (fs.existsSync(filePath)) {
      safeDeleteFile(filePath, backupPath)
      deletedFiles.push(file)
    }
  }

  // 第二阶段：处理需要小心的文件
  if (plan.riskDeletion.length > 0) {
    console.log('\n📋 第二阶段：处理需要小心的文件')
    console.log('⚠️  这些文件有依赖关系，将逐个处理并修复依赖')

    for (const { file, analysis } of plan.riskDeletion) {
      console.log(`\n🔍 处理: ${file} (被${analysis.directDependents.length}个文件依赖)`)

      const filePath = path.join(SERVICES_DIR, file)
      if (fs.existsSync(filePath)) {
        // 备份并删除
        safeDeleteFile(filePath, backupPath)
        deletedFiles.push(file)

        // 立即修复依赖
        fixDependencies([file])

        // 检查依赖文件的健康状态
        for (const dependent of analysis.directDependents) {
          const dependentPath = path.join(SERVICES_DIR, dependent)
          if (fs.existsSync(dependentPath)) {
            checkDependencyHealth(dependentPath)
          }
        }
      }
    }
  }

  // 第三阶段：处理高风险文件
  if (plan.needsReview.length > 0) {
    console.log('\n📋 第三阶段：处理高风险文件')
    console.log('⚠️  这些文件被核心文件依赖，需要手动审查')

    for (const { file, analysis } of plan.needsReview) {
      console.log(`\n🔍 高风险文件: ${file}`)
      console.log(`   被核心文件依赖: ${analysis.coreDependents.join(', ')}`)
      console.log('   跳过自动删除，需要手动处理')
    }
  }

  return deletedFiles
}

// 主函数
async function main() {
  console.log('🚀 开始安全清理流程...\n')

  // 检查系统健康状态
  if (!checkSystemHealth()) {
    console.error('❌ 系统健康检查失败，终止清理')
    process.exit(1)
  }

  // 创建备份
  const backupPath = createBackup()
  console.log(`📦 创建备份目录: ${path.relative(SERVICES_DIR, backupPath)}\n`)

  // 加载分析结果
  const analysisResult = loadAnalysisResult()
  console.log(`📊 加载分析结果，准备清理 ${analysisResult.deletionTargets.length} 个目标文件\n`)

  // 执行清理
  const deletedFiles = await performCleanup(analysisResult, backupPath)

  // 最终检查
  console.log('\n🔍 最终系统健康检查...')
  let healthyCount = 0
  let totalCount = 0

  const allFiles = getAllTypeScriptFiles(SERVICES_DIR)
  for (const file of allFiles) {
    totalCount++
    if (checkDependencyHealth(file)) {
      healthyCount++
    }
  }

  console.log(`\n✅ 清理完成!`)
  console.log(`📊 删除文件数: ${deletedFiles.length}`)
  console.log(`🔧 文件健康状态: ${healthyCount}/${totalCount}`)
  console.log(`📦 备份位置: ${path.relative(SERVICES_DIR, backupPath)}`)

  // 保存清理报告
  const cleanupReport = {
    timestamp: new Date().toISOString(),
    backupPath: path.relative(SERVICES_DIR, backupPath),
    deletedFiles,
    healthCheck: {
      totalFiles: totalCount,
      healthyFiles: healthyCount,
      successRate: ((healthyCount / totalCount) * 100).toFixed(2) + '%'
    }
  }

  fs.writeFileSync(
    path.join(SERVICES_DIR, 'cleanup-report.json'),
    JSON.stringify(cleanupReport, null, 2)
  )

  console.log(`📋 清理报告已保存到 cleanup-report.json`)

  if (healthyCount < totalCount * 0.9) {
    console.warn('⚠️  警告：发现较多依赖问题，建议检查清理报告')
    process.exit(1)
  }
}

// 运行清理
main().catch(error => {
  console.error('❌ 清理过程中发生错误:', error)
  process.exit(1)
})