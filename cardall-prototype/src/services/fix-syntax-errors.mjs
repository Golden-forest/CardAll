#!/usr/bin/env node

/**
 * 修复语法错误脚本
 * 批量修复删除冗余代码后产生的语法错误
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SERVICES_DIR = __dirname

// 修复单个文件的语法错误
function fixSyntaxErrors(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    let modified = false
    const relativePath = path.relative(SERVICES_DIR, filePath)

    console.log(`🔧 检查文件: ${relativePath}`)

    // 修复模式1: 多余的右括号在catch语句后
    const pattern1 = /} catch \(error\) \{ console\.warn\("操作失败:", error\) \}\)/g
    if (pattern1.test(content)) {
      content = content.replace(pattern1, '} catch (error) { console.warn("操作失败:", error) }')
      modified = true
      console.log(`   修复多余右括号`)
    }

    // 修复模式2: console.warn语句的语法问题
    const pattern2 = /console\.warn\("([^"]+):", error\) ([^}]+)/g
    if (pattern2.test(content)) {
      content = content.replace(pattern2, 'console.warn("$1:", error)\n          $2')
      modified = true
      console.log(`   修复console.warn语法`)
    }

    // 修复模式3: 缺失的分号
    const pattern3 = /} catch \(error\) \{ ([^}]+) \}/g
    if (pattern3.test(content)) {
      content = content.replace(pattern3, '} catch (error) {\n          $1\n        }')
      modified = true
      console.log(`   修复catch块格式`)
    }

    // 修复模式4: 混合的中英文标点
    const pattern4 = /，/g
    if (pattern4.test(content)) {
      content = content.replace(pattern4, ',')
      modified = true
      console.log(`   修复中文标点`)
    }

    // 修复模式5: 重复的错误处理
    const pattern5 = /console\.warn\("操作失败:", error\)([^}]*})\s*} catch \(error\)/g
    if (pattern5.test(content)) {
      content = content.replace(pattern5, 'console.warn("操作失败:", error)\n        } catch (error)')
      modified = true
      console.log(`   修复重复错误处理`)
    }

    if (modified) {
      fs.writeFileSync(filePath, content)
      console.log(`✅ 已修复: ${relativePath}`)
      return true
    } else {
      console.log(`ℹ️  无需修复: ${relativePath}`)
      return false
    }

  } catch (error) {
    console.error(`❌ 修复文件失败 ${filePath}:`, error.message)
    return false
  }
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

// 主函数
function main() {
  console.log('🚀 开始修复语法错误...\n')

  // 重点修复app-init.ts文件
  const appInitPath = path.join(SERVICES_DIR, 'app-init.ts')
  if (fs.existsSync(appInitPath)) {
    console.log('🎯 重点修复 app-init.ts...')
    fixSyntaxErrors(appInitPath)
  }

  // 获取所有TypeScript文件
  const allFiles = getAllTypeScriptFiles(SERVICES_DIR)
  console.log(`\n📊 找到 ${allFiles.length} 个TypeScript文件`)

  let fixedCount = 0
  let errorCount = 0

  // 修复每个文件
  for (const file of allFiles) {
    try {
      if (fixSyntaxErrors(file)) {
        fixedCount++
      }
    } catch (error) {
      console.error(`❌ 处理文件失败 ${file}:`, error.message)
      errorCount++
    }
  }

  console.log(`\n✅ 语法错误修复完成!`)
  console.log(`📊 修复文件数: ${fixedCount}`)
  console.log(`❌ 错误文件数: ${errorCount}`)

  // 保存修复报告
  const fixReport = {
    timestamp: new Date().toISOString(),
    totalFiles: allFiles.length,
    fixedFiles: fixedCount,
    errorFiles: errorCount
  }

  fs.writeFileSync(
    path.join(SERVICES_DIR, 'syntax-fix-report.json'),
    JSON.stringify(fixReport, null, 2)
  )

  console.log(`📋 修复报告已保存到 syntax-fix-report.json`)

  if (errorCount > 0) {
    console.warn('⚠️  警告：发现错误，建议检查修复报告')
    process.exit(1)
  }
}

// 运行修复
main().catch(error => {
  console.error('❌ 修复过程中发生错误:', error)
  process.exit(1)
})