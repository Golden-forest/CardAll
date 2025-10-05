/**
 * 数据完整性检查器使用示例
 *
 * 展示如何在实际应用中使用数据完整性检查器的各种功能
 */

import {
  dataIntegrityChecker,
  IntegrityCheckType,
  EntityType,
  SeverityLevel,
  type CheckOptions,
  type ScheduledCheck,
  type IntegrityIssue
} from './data-integrity-checker'
import { syncOrchestrator } from './sync-orchestrator'

// ============================================================================
// 基础使用示例
// ============================================================================

/**
 * 初始化并启动数据完整性检查器
 */
export async function initializeIntegrityChecker() {
  try {
    // 初始化检查器
    await dataIntegrityChecker.initialize({
      enabled: true,
      autoStart: true,
      checkInterval: 3600000, // 1小时
      enableAutoFix: true,
      autoFixThreshold: SeverityLevel.WARNING,
      enableDetailedReports: true,
      notificationEnabled: true
    })

    console.log('数据完整性检查器初始化成功')
  } catch (error) {
    console.error('数据完整性检查器初始化失败:', error)
  }
}

/**
 * 运行完整的完整性检查
 */
export async function runFullIntegrityCheck() {
  try {
    console.log('开始运行完整的数据完整性检查...')

    const result = await dataIntegrityChecker.runFullCheck({
      autoFix: true,
      timeout: 300000 // 5分钟超时
    })

    console.log('完整性检查完成:', {
      状态: result.status,
      总问题数: result.summary.totalIssues,
      严重问题: result.summary.criticalIssues,
      自动修复: result.autoFixed,
      需要用户处理: result.requiresUserAction
    })

    // 显示建议
    if (result.recommendations.length > 0) {
      console.log('改进建议:')
      result.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`)
      })
    }

    return result
  } catch (error) {
    console.error('完整性检查失败:', error)
    throw error
  }
}

/**
 * 运行特定类型的检查
 */
export async function runSpecificChecks() {
  // 1. 只检查哈希一致性
  console.log('检查数据哈希一致性...')
  const hashResult = await dataIntegrityChecker.runSpecificCheck(
    IntegrityCheckType.HASH,
    EntityType.CARD
  )
  console.log(`哈希检查完成，发现 ${hashResult.issues.length} 个问题`)

  // 2. 只检查引用完整性
  console.log('检查引用完整性...')
  const referenceResult = await dataIntegrityChecker.runSpecificCheck(
    IntegrityCheckType.REFERENCE,
    EntityType.CARD
  )
  console.log(`引用检查完成，发现 ${referenceResult.issues.length} 个问题`)

  // 3. 检查元数据一致性
  console.log('检查元数据一致性...')
  const metadataResult = await dataIntegrityChecker.runSpecificCheck(
    IntegrityCheckType.METADATA,
    EntityType.CARD
  )
  console.log(`元数据检查完成，发现 ${metadataResult.issues.length} 个问题`)
}

/**
 * 运行部分检查（自定义检查范围）
 */
export async function runPartialChecks() {
  const options: CheckOptions = {
    checkTypes: [
      IntegrityCheckType.HASH,
      IntegrityCheckType.REFERENCE
    ],
    entityTypes: [EntityType.CARD, EntityType.FOLDER],
    autoFix: false, // 不自动修复，只报告问题
    priority: 'high'
  }

  const result = await dataIntegrityChecker.runPartialCheck(options)

  console.log('部分检查完成:', {
    检查类型: options.checkTypes,
    实体类型: options.entityTypes,
    问题数量: result.issues.length,
    检查耗时: result.duration
  })

  return result
}

// ============================================================================
// 问题管理示例
// ============================================================================

/**
 * 获取并显示问题列表
 */
export async function displayIntegrityIssues() {
  try {
    // 获取所有问题
    const allIssues = await dataIntegrityChecker.getIssues()
    console.log(`总共发现 ${allIssues.length} 个完整性问题`)

    // 按严重程度分组显示
    const issuesBySeverity = {
      [SeverityLevel.CRITICAL]: allIssues.filter(i => i.severity === SeverityLevel.CRITICAL),
      [SeverityLevel.ERROR]: allIssues.filter(i => i.severity === SeverityLevel.ERROR),
      [SeverityLevel.WARNING]: allIssues.filter(i => i.severity === SeverityLevel.WARNING),
      [SeverityLevel.INFO]: allIssues.filter(i => i.severity === SeverityLevel.INFO)
    }

    Object.entries(issuesBySeverity).forEach(([severity, issues]) => {
      if (issues.length > 0) {
        console.log(`\n${severity} 级别问题 (${issues.length} 个):`)
        issues.forEach(issue => {
          console.log(`  - ${issue.title}: ${issue.description}`)
          if (issue.autoFixable) {
            console.log(`    ✓ 可自动修复`)
          } else {
            console.log(`    ⚠ 需要手动处理`)
          }
        })
      }
    })

    return allIssues
  } catch (error) {
    console.error('获取问题列表失败:', error)
  }
}

/**
 * 获取特定类型的问题
 */
export async function getFilteredIssues() {
  // 1. 获取严重问题
  const criticalIssues = await dataIntegrityChecker.getIssues({
    severities: [SeverityLevel.CRITICAL, SeverityLevel.ERROR]
  })
  console.log(`严重问题: ${criticalIssues.length} 个`)

  // 2. 获取可自动修复的问题
  const autoFixableIssues = await dataIntegrityChecker.getIssues({
    autoFixable: true
  })
  console.log(`可自动修复的问题: ${autoFixableIssues.length} 个`)

  // 3. 获取特定实体类型的问题
  const cardIssues = await dataIntegrityChecker.getIssues({
    entityTypes: [EntityType.CARD]
  })
  console.log(`卡片相关问题: ${cardIssues.length} 个`)

  // 4. 获取特定检查类型的问题
  const hashIssues = await dataIntegrityChecker.getIssues({
    types: [IntegrityCheckType.HASH]
  })
  console.log(`哈希相关问题: ${hashIssues.length} 个`)

  return {
    criticalIssues,
    autoFixableIssues,
    cardIssues,
    hashIssues
  }
}

/**
 * 修复单个问题
 */
export async function fixSingleIssue(issueId: string) {
  try {
    // 首先获取问题详情
    const issues = await dataIntegrityChecker.getIssues()
    const issue = issues.find(i => i.id === issueId)

    if (!issue) {
      console.error('问题不存在:', issueId)
      return false
    }

    console.log(`修复问题: ${issue.title}`)

    if (issue.autoFixable) {
      // 选择最佳修复建议
      const bestSuggestion = issue.fixSuggestions
        .sort((a, b) => b.confidence - a.confidence)[0]

      if (bestSuggestion) {
        const success = await dataIntegrityChecker.fixIssue(
          issueId,
          bestSuggestion.id,
          bestSuggestion.requiresConfirmation
        )

        if (success) {
          console.log(`✓ 问题修复成功: ${bestSuggestion.title}`)
        } else {
          console.log(`✗ 问题修复失败: ${bestSuggestion.title}`)
        }

        return success
      }
    } else {
      console.log('⚠ 此问题需要手动处理')
      return false
    }
  } catch (error) {
    console.error('修复问题失败:', error)
    return false
  }
}

/**
 * 批量修复问题
 */
export async function fixMultipleIssues(issueIds: string[]) {
  try {
    const issues = await dataIntegrityChecker.getIssues()
    const issueFixes = []

    for (const issueId of issueIds) {
      const issue = issues.find(i => i.id === issueId)
      if (issue && issue.autoFixable) {
        const bestSuggestion = issue.fixSuggestions
          .sort((a, b) => b.confidence - a.confidence)[0]

        if (bestSuggestion && !bestSuggestion.requiresConfirmation) {
          issueFixes.push({
            issueId,
            fixSuggestionId: bestSuggestion.id
          })
        }
      }
    }

    if (issueFixes.length === 0) {
      console.log('没有可自动修复的问题')
      return []
    }

    console.log(`批量修复 ${issueFixes.length} 个问题...`)

    const results = await dataIntegrityChecker.fixMultipleIssues(issueFixes)
    const successCount = results.filter(r => r).length

    console.log(`批量修复完成: ${successCount}/${issueFixes.length} 个问题修复成功`)

    return results
  } catch (error) {
    console.error('批量修复失败:', error)
    return []
  }
}

// ============================================================================
// 定期检查示例
// ============================================================================

/**
 * 创建定期检查
 */
export async function setupScheduledChecks() {
  try {
    // 1. 每日完整检查（凌晨2点）
    const dailyCheckId = await dataIntegrityChecker.createScheduledCheck({
      name: '每日完整检查',
      enabled: true,
      schedule: '24 hours', // 实际应该使用cron表达式
      checkTypes: [
        IntegrityCheckType.HASH,
        IntegrityCheckType.METADATA,
        IntegrityCheckType.REFERENCE,
        IntegrityCheckType.STRUCTURE,
        IntegrityCheckType.CONSISTENCY
      ],
      entityTypes: [EntityType.CARD, EntityType.FOLDER, EntityType.TAG],
      autoFix: true,
      notificationSettings: {
        enabled: true,
        onIssue: true,
        onCompletion: false,
        onFailure: true
      }
    })

    console.log('创建每日检查成功:', dailyCheckId)

    // 2. 每小时快速检查（只检查哈希）
    const hourlyCheckId = await dataIntegrityChecker.createScheduledCheck({
      name: '每小时快速检查',
      enabled: true,
      schedule: '1 hour',
      checkTypes: [IntegrityCheckType.HASH],
      entityTypes: [EntityType.CARD],
      autoFix: false,
      notificationSettings: {
        enabled: true,
        onIssue: true,
        onCompletion: false,
        onFailure: true
      }
    })

    console.log('创建每小时检查成功:', hourlyCheckId)

    // 3. 每周深度检查
    const weeklyCheckId = await dataIntegrityChecker.createScheduledCheck({
      name: '每周深度检查',
      enabled: true,
      schedule: '168 hours', // 7天
      checkTypes: [
        IntegrityCheckType.HASH,
        IntegrityCheckType.METADATA,
        IntegrityCheckType.REFERENCE,
        IntegrityCheckType.STRUCTURE,
        IntegrityCheckType.CONSISTENCY
      ],
      entityTypes: [EntityType.CARD, EntityType.FOLDER, EntityType.TAG],
      autoFix: false, // 深度检查不自动修复
      notificationSettings: {
        enabled: true,
        onIssue: true,
        onCompletion: true,
        onFailure: true
      }
    })

    console.log('创建每周检查成功:', weeklyCheckId)

    return {
      dailyCheckId,
      hourlyCheckId,
      weeklyCheckId
    }
  } catch (error) {
    console.error('创建定期检查失败:', error)
  }
}

/**
 * 管理定期检查
 */
export async function manageScheduledChecks() {
  try {
    // 获取所有定期检查
    const scheduledChecks = await dataIntegrityChecker.getScheduledChecks()
    console.log('当前定期检查:', scheduledChecks.map(c => ({
      名称: c.name,
      启用: c.enabled,
      上次运行: c.lastRun,
      下次运行: c.nextRun
    })))

    // 禁用某个检查
    if (scheduledChecks.length > 0) {
      const firstCheck = scheduledChecks[0]
      await dataIntegrityChecker.updateScheduledCheck(firstCheck.id, {
        enabled: false
      })
      console.log(`已禁用检查: ${firstCheck.name}`)
    }

    // 手动运行某个检查
    if (scheduledChecks.length > 1) {
      const secondCheck = scheduledChecks[1]
      console.log(`手动运行检查: ${secondCheck.name}`)
      const result = await dataIntegrityChecker.runScheduledCheck(secondCheck.id)
      console.log(`检查完成，发现 ${result.issues.length} 个问题`)
    }

  } catch (error) {
    console.error('管理定期检查失败:', error)
  }
}

// ============================================================================
// 报告和分析示例
// ============================================================================

/**
 * 生成并显示完整性报告
 */
export async function generateIntegrityReport() {
  try {
    // 首先运行一次检查
    const checkResult = await dataIntegrityChecker.runFullCheck()

    // 生成详细报告
    const report = await dataIntegrityChecker.generateReport(checkResult.id)

    console.log('=== 数据完整性报告 ===')
    console.log(`报告ID: ${report.id}`)
    console.log(`生成时间: ${report.generatedAt.toLocaleString()}`)
    console.log(`检查ID: ${report.checkId}`)

    // 显示摘要
    console.log('\n--- 检查摘要 ---')
    console.log(`总问题数: ${report.summary.totalIssues}`)
    console.log(`严重问题: ${report.summary.criticalIssues}`)
    console.log(`错误问题: ${report.summary.errorIssues}`)
    console.log(`警告问题: ${report.summary.warningIssues}`)
    console.log(`信息问题: ${report.summary.infoIssues}`)

    // 显示建议
    console.log('\n--- 改进建议 ---')
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec.title}`)
      console.log(`   影响: ${rec.impact}`)
      console.log(`   工作量: ${rec.effort}`)
      console.log(`   类别: ${rec.category}`)
      console.log(`   行动:`)
      rec.actions.forEach(action => console.log(`     - ${action}`))
      console.log('')
    })

    return report
  } catch (error) {
    console.error('生成报告失败:', error)
  }
}

/**
 * 获取完整性指标
 */
export async function getIntegrityMetrics() {
  try {
    // 获取最近7天的指标
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000)

    const metrics = await dataIntegrityChecker.getIntegrityMetrics({
      start: startTime,
      end: endTime
    })

    console.log('=== 完整性指标 (最近7天) ===')
    console.log(`总检查次数: ${metrics.totalChecks}`)
    console.log(`成功检查: ${metrics.successfulChecks}`)
    console.log(`失败检查: ${metrics.failedChecks}`)
    console.log(`平均检查时间: ${metrics.averageCheckTime.toFixed(2)}ms`)
    console.log(`发现总问题: ${metrics.totalIssuesDetected}`)
    console.log(`修复总问题: ${metrics.totalIssuesFixed}`)

    console.log('\n--- 问题按类型分布 ---')
    Object.entries(metrics.issuesByType).forEach(([type, count]) => {
      console.log(`${type}: ${count} 个`)
    })

    console.log('\n--- 问题按严重程度分布 ---')
    Object.entries(metrics.issuesBySeverity).forEach(([severity, count]) => {
      console.log(`${severity}: ${count} 个`)
    })

    // 显示趋势
    if (metrics.trends.detected.length > 1) {
      console.log('\n--- 问题发现趋势 ---')
      metrics.trends.detected.slice(-5).forEach(trend => {
        console.log(`${trend.date.toLocaleDateString()}: ${trend.count} 个问题`)
      })
    }

    return metrics
  } catch (error) {
    console.error('获取指标失败:', error)
  }
}

/**
 * 获取检查历史
 */
export async function getCheckHistory() {
  try {
    const history = await dataIntegrityChecker.getCheckHistory(10)

    console.log('=== 检查历史 (最近10次) ===')
    history.forEach((check, index) => {
      console.log(`${index + 1}. ${check.startTime.toLocaleString()}`)
      console.log(`   状态: ${check.status}`)
      console.log(`   耗时: ${check.duration}ms`)
      console.log(`   检查实体: ${check.checkedEntities}`)
      console.log(`   发现问题: ${check.summary.totalIssues}`)
      console.log(`   自动修复: ${check.autoFixed}`)
      console.log('')
    })

    return history
  } catch (error) {
    console.error('获取检查历史失败:', error)
  }
}

// ============================================================================
// 与同步服务集成示例
// ============================================================================

/**
 * 通过同步编排器运行完整性检查
 */
export async function runIntegrityCheckViaOrchestrator() {
  try {
    console.log('通过同步编排器运行完整性检查...')

    const result = await syncOrchestrator.orchestrateIntegrityCheck({
      checkTypes: [IntegrityCheckType.HASH, IntegrityCheckType.REFERENCE],
      entityTypes: [EntityType.CARD],
      autoFix: true
    })

    console.log('编排器检查完成:', {
      状态: result.status,
      问题数量: result.issues.length,
      自动修复: result.autoFixed
    })

    return result
  } catch (error) {
    console.error('编排器检查失败:', error)
  }
}

/**
 * 监听完整性检查事件
 */
export function setupIntegrityEventListeners() {
  // 监听检查开始
  dataIntegrityChecker.on('integrity:check:started', (data) => {
    console.log('完整性检查开始:', data.checkId)
  })

  // 监听检查完成
  dataIntegrityChecker.on('integrity:check:completed', (data) => {
    console.log('完整性检查完成:', {
      checkId: data.result.id,
      问题数量: data.result.issues.length,
      耗时: data.result.duration
    })
  })

  // 监听检查失败
  dataIntegrityChecker.on('integrity:check:failed', (data) => {
    console.error('完整性检查失败:', data.error)
  })

  // 监听问题通知
  dataIntegrityChecker.on('integrity:notification', (data) => {
    console.log('完整性通知:', data)
  })

  console.log('完整性检查事件监听器已设置')
}

// ============================================================================
// 完整的使用流程示例
// ============================================================================

/**
 * 完整的数据完整性检查使用流程
 */
export async function completeIntegrityCheckWorkflow() {
  try {
    console.log('=== 开始完整的数据完整性检查工作流程 ===')

    // 1. 初始化检查器
    console.log('1. 初始化数据完整性检查器...')
    await initializeIntegrityChecker()

    // 2. 设置事件监听
    console.log('2. 设置事件监听器...')
    setupIntegrityEventListeners()

    // 3. 设置定期检查
    console.log('3. 设置定期检查...')
    await setupScheduledChecks()

    // 4. 运行完整检查
    console.log('4. 运行完整的数据完整性检查...')
    const checkResult = await runFullIntegrityCheck()

    // 5. 显示问题
    console.log('5. 显示发现的问题...')
    await displayIntegrityIssues()

    // 6. 修复可自动修复的问题
    console.log('6. 修复可自动修复的问题...')
    const issues = await dataIntegrityChecker.getIssues({ autoFixable: true })
    if (issues.length > 0) {
      const issueIds = issues.slice(0, 5).map(i => i.id) // 修复前5个问题
      await fixMultipleIssues(issueIds)
    }

    // 7. 生成报告
    console.log('7. 生成完整性报告...')
    await generateIntegrityReport()

    // 8. 获取指标
    console.log('8. 获取完整性指标...')
    await getIntegrityMetrics()

    console.log('=== 数据完整性检查工作流程完成 ===')
    return checkResult

  } catch (error) {
    console.error('完整性检查工作流程失败:', error)
    throw error
  }
}

// ============================================================================
// 导出示例函数供外部使用
// ============================================================================

export const IntegrityCheckerExamples = {
  // 基础功能
  initializeIntegrityChecker,
  runFullIntegrityCheck,
  runSpecificChecks,
  runPartialChecks,

  // 问题管理
  displayIntegrityIssues,
  getFilteredIssues,
  fixSingleIssue,
  fixMultipleIssues,

  // 定期检查
  setupScheduledChecks,
  manageScheduledChecks,

  // 报告和分析
  generateIntegrityReport,
  getIntegrityMetrics,
  getCheckHistory,

  // 集成功能
  runIntegrityCheckViaOrchestrator,
  setupIntegrityEventListeners,

  // 完整流程
  completeIntegrityCheckWorkflow
}

export default IntegrityCheckerExamples