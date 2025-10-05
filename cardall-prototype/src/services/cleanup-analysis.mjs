#!/usr/bin/env node

/**
 * 依赖关系分析和清理脚本
 * 用于安全删除冗余代码前的依赖关系分析
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SERVICES_DIR = __dirname

// 主要删除目标（冗余代码）
const DELETION_TARGETS = [
  'sync-queue.ts',           // 3345行 - 复杂的同步队列
  'conflict-resolver.ts',    // 1904行 - 过度复杂的冲突解决
  'network-manager.ts',      // 2254行 - 复杂的网络管理
  'unified-sync-service.ts', // 1735行 - 冗余的统一同步服务
  'cloud-sync.ts',           // 780行 - 冗余的云同步
  'enhanced-conflict-detection.ts',
  'intelligent-merge-strategy.ts',
  'performance-optimizer.ts',
  'memory-optimization-manager.ts',
  'advanced-cache.ts',
  'comprehensive-performance-monitor.ts',
  'sync-orchestrator.ts',
  'sync-diagnostics.ts',
  'data-consistency-validator.ts',
  'data-integrity-service.ts'
]

// 核心保留文件（不能删除）
const CORE_FILES = [
  'database.ts',
  'auth.ts',
  'simple-sync-service.ts',
  'supabase.ts',
  'image-processor.ts',
  'error-handler.ts',
  'storage-adapter.ts',
  'local-operation.ts',
  'backup-service.ts'
]

/**
 * 提取文件中的import语句
 */
function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const imports = []

    // 匹配 import 语句
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      // 只关心相对路径的import
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        imports.push(importPath)
      }
    }

    return imports
  } catch (error) {
    console.warn(`无法读取文件 ${filePath}:`, error.message)
    return []
  }
}

/**
 * 获取所有.ts文件的列表
 */
function getAllTypeScriptFiles(dir) {
  const files = []

  function traverse(currentDir) {
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
  }

  traverse(dir)
  return files
}

/**
 * 构建依赖关系图
 */
function buildDependencyGraph() {
  const allFiles = getAllTypeScriptFiles(SERVICES_DIR)
  const graph = {}
  const reverseGraph = {} // 反向依赖图

  for (const file of allFiles) {
    const relativePath = path.relative(SERVICES_DIR, file).replace(/\\/g, '/')
    const imports = extractImports(file)

    graph[relativePath] = imports

    // 构建反向依赖图
    for (const importPath of imports) {
      const resolvedImport = resolveImportPath(relativePath, importPath)
      if (resolvedImport && !reverseGraph[resolvedImport]) {
        reverseGraph[resolvedImport] = []
      }
      if (resolvedImport) {
        reverseGraph[resolvedImport].push(relativePath)
      }
    }
  }

  return { graph, reverseGraph }
}

/**
 * 解析import路径为实际文件路径
 */
function resolveImportPath(fromFile, importPath) {
  const fromDir = path.dirname(fromFile)
  let resolvedPath = path.normalize(path.join(fromDir, importPath))

  // 添加.ts扩展名
  if (!resolvedPath.endsWith('.ts')) {
    resolvedPath += '.ts'
  }

  // 检查文件是否存在
  const fullPath = path.join(SERVICES_DIR, resolvedPath)
  if (fs.existsSync(fullPath)) {
    return resolvedPath.replace(/\\/g, '/')
  }

  // 尝试index.ts文件
  const indexPath = path.join(resolvedPath, 'index.ts')
  const indexFullPath = path.join(SERVICES_DIR, indexPath)
  if (fs.existsSync(indexFullPath)) {
    return indexPath.replace(/\\/g, '/')
  }

  return null
}

/**
 * 分析删除影响
 */
function analyzeDeletionImpact(dependencyGraph, reverseGraph) {
  console.log('🔍 分析删除影响...\n')

  const impact = {}

  for (const target of DELETION_TARGETS) {
    if (!fs.existsSync(path.join(SERVICES_DIR, target))) {
      console.log(`⚠️  文件不存在: ${target}`)
      continue
    }

    const dependents = reverseGraph[target] || []
    const directDependents = dependents.filter(dep => !CORE_FILES.includes(dep))
    const coreDependents = dependents.filter(dep => CORE_FILES.includes(dep))

    impact[target] = {
      directDependents,
      coreDependents,
      totalDependents: dependents.length,
      riskLevel: coreDependents.length > 0 ? 'HIGH' : 'MEDIUM'
    }

    console.log(`📁 ${target}`)
    console.log(`   依赖此文件的文件数: ${dependents.length}`)
    console.log(`   核心文件依赖: ${coreDependents.length > 0 ? coreDependents.join(', ') : '无'}`)
    console.log(`   风险级别: ${impact[target].riskLevel}`)
    console.log('')
  }

  return impact
}

/**
 * 生成删除计划
 */
function generateDeletionPlan(impact) {
  console.log('📋 生成安全删除计划...\n')

  // 按风险级别分组
  const safeToDelete = []
  const riskDeletion = []
  const needsReview = []

  for (const [file, analysis] of Object.entries(impact)) {
    if (analysis.riskLevel === 'HIGH') {
      needsReview.push({ file, analysis })
    } else if (analysis.totalDependents === 0) {
      safeToDelete.push({ file, analysis })
    } else {
      riskDeletion.push({ file, analysis })
    }
  }

  console.log(`✅ 安全删除 (${safeToDelete.length}个文件):`)
  safeToDelete.forEach(({ file }) => console.log(`   - ${file}`))

  console.log(`\n⚠️  需要小心删除 (${riskDeletion.length}个文件):`)
  riskDeletion.forEach(({ file, analysis }) => {
    console.log(`   - ${file} (被${analysis.directDependents.length}个文件依赖)`)
  })

  console.log(`\n🔥 高风险删除 (${needsReview.length}个文件):`)
  needsReview.forEach(({ file, analysis }) => {
    console.log(`   - ${file} (被核心文件依赖: ${analysis.coreDependents.join(', ')})`)
  })

  return { safeToDelete, riskDeletion, needsReview }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始依赖关系分析...\n')

  // 构建依赖图
  const { graph, reverseGraph } = buildDependencyGraph()

  // 分析删除影响
  const impact = analyzeDeletionImpact(graph, reverseGraph)

  // 生成删除计划
  const plan = generateDeletionPlan(impact)

  // 保存分析结果
  const analysisResult = {
    timestamp: new Date().toISOString(),
    deletionTargets: DELETION_TARGETS,
    coreFiles: CORE_FILES,
    impact,
    plan,
    dependencyGraph: graph,
    reverseDependencyGraph: reverseGraph
  }

  fs.writeFileSync(
    path.join(SERVICES_DIR, 'cleanup-analysis-result.json'),
    JSON.stringify(analysisResult, null, 2)
  )

  console.log(`\n✅ 分析完成! 结果已保存到 cleanup-analysis-result.json`)
  console.log(`📊 总计分析 ${DELETION_TARGETS.length} 个目标文件`)
  console.log(`🗑️  可安全删除: ${plan.safeToDelete.length} 个`)
  console.log(`⚠️  需要小心处理: ${plan.riskDeletion.length} 个`)
  console.log(`🔥 需要特别审查: ${plan.needsReview.length} 个`)
}

// 运行分析
main()