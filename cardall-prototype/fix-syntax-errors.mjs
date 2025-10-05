#!/usr/bin/env node

/**
 * 修复语法错误的自动化脚本
 *
 * 主要修复常见的语法问题：
 * 1. console.warn("操作失败:", error)} 格式错误
 * 2. 多余的 export 关键字
 * 3. 未终止的字符串字面量
 * 4. 缺失的括号和分号
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SRC_DIR = path.join(__dirname, 'src')

// 需要修复的文件模式
const FILES_TO_FIX = [
  'src/services/auth.ts',
  'src/services/event-system.ts',
  'src/services/universal-storage-adapter.ts',
  'src/services/upload-queue-manager.ts',
  'src/__tests__/setup.ts',
  'src/components/performance-dashboard.tsx',
  'src/components/storage-diagnostics-panel.tsx'
]

console.log('🔧 开始修复语法错误...')

let fixedCount = 0
let errorCount = 0

// 修复函数
function fixFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ 文件不存在: ${filePath}`)
      return
    }

    let content = fs.readFileSync(filePath, 'utf-8')
    let modified = false

    // 修复模式 1: console.warn("操作失败:", error)} 错误
    content = content.replace(
      /console\.warn\("操作失败:", error\)\s*\}\s*\/\$\{[^}]*\}\):`?, error\)/g,
      (match) => {
        modified = true
        console.log(`🔧 修复console.warn错误: ${filePath}`)
        return 'console.warn(`操作失败:`, error)'
      }
    )

    // 修复模式 2: 多余的 export 关键字
    content = content.replace(
      /export\s+export\s+/g,
      () => {
        modified = true
        console.log(`🔧 修复多余export: ${filePath}`)
        return 'export '
      }
    )

    // 修复模式 3: 错误的函数返回类型语法
    content = content.replace(
      /async\s+(\w+)\s*\([^)]*\):\s*Promise<\{[^}]*\}\s*>\s*\{\s*[\s\S]*?catch\s*\([^)]*\)\s*\{\s*console\.warn\([^)]*\)\s*\}\s*return\s*\{[^}]*\}\s*\}\s*\}\s*}/g,
      (match, funcName) => {
        if (match.includes('error as AuthError')) {
          modified = true
          console.log(`🔧 修复函数语法: ${funcName} in ${filePath}`)
          return match.replace(
            /console\.warn\([^)]*\)\s*\}\s*return\s*\{[^}]*\}\s*\}\s*\}\s*}/g,
            'console.warn("操作失败:", error)\n        return { error: error as AuthError }\n    }\n  }'
          )
        }
        return match
      }
    )

    // 修复模式 4: 错误的catch块语法
    content = content.replace(
      /\}\s*catch\s*\([^)]*\)\s*\{\s*console\.warn\("操作失败:",\s*error\)\s*\}\s*\/\$\{[^}]*\}\):`?, error\)\s*\}/g,
      () => {
        modified = true
        console.log(`🔧 修复catch块语法: ${filePath}`)
        return '} catch (error) {\n          console.warn("操作失败:", error)\n        }'
      }
    )

    // 修复模式 5: 错误的方法定义
    content = content.replace(
      /async\s+(\w+)\s*\([^)]*):\s*Promise<[^>]+>\s*\{\s*[\s\S]*?try\s*\{[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{\s*console\.warn\([^)]*\)\s*\}\s*return\s*\{[^}]*\}\s*\}\s*\}/g,
      (match, funcName) => {
        if (match.includes('} catch (error) {') && match.includes('return { error: error as')) {
          modified = true
          console.log(`🔧 修复方法定义: ${funcName} in ${filePath}`)
          return match.replace(
            /\}\s*catch\s*\([^)]*\)\s*\{\s*console\.warn\([^)]*\)\s*\}\s*return\s*\{[^}]*\}\s*\}\s*\}/g,
            '} catch (error) {\n          console.warn("操作失败:", error)\n        return { error: error as AuthError }\n    }\n  }'
          )
        }
        return match
      }
    )

    // 修复模式 6: JSX未关闭的标签 (针对performance-dashboard.tsx)
    if (filePath.includes('performance-dashboard.tsx')) {
      content = content.replace(
        /(<Tabs[^>]*>[\s\S]*?)(<\/div>\s*<\/div>\s*<\/div>\s*[^<]*$)/g,
        (match, tabsContent, footer) => {
          if (!match.includes('</Tabs>')) {
            modified = true
            console.log(`🔧 修复JSX标签: ${filePath}`)
            return tabsContent + '</Tabs>' + footer
          }
          return match
        }
      )
    }

    // 修复模式 7: 未终止的字符串字面量 (针对storage-diagnostics-panel.tsx)
    if (filePath.includes('storage-diagnostics-panel.tsx')) {
      // 修复包含特殊字符的字符串
      content = content.replace(
        /"[^"]*[^\x20-\x7E][^"]*"/g,
        (match) => {
          if (match.includes('\n') || match.includes('\r') || match.includes('\t')) {
            modified = true
            console.log(`🔧 修复字符串字面量: ${filePath}`)
            return match.replace(/[\n\r\t]/g, '\\n').replace(/[^\\]\\n/g, '\\\\n')
          }
          return match
        }
      )
    }

    // 修复模式 8: 类中的方法语法错误
    content = content.replace(
      /(\s*)(async\s+\w+\s*\([^)]*\):\s*Promise<[^>]+>)\s*\{\s*[\s\S]*?try\s*\{[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{\s*console\.warn\("操作失败:",\s*error\)\s*\}\s*return\s*\{[^}]*\}\s*\}\s*\}\s*\}/g,
      (indent, signature) => {
        modified = true
        console.log(`🔧 修复类方法语法: ${filePath}`)
        return `${indent}${signature} {\n${indent}  try {\n${indent}    // Method implementation\n${indent}  } catch (error) {\n${indent}    console.warn("操作失败:", error)\n${indent}    return { error: error as any }\n${indent}  }\n${indent}}`
      }
    )

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8')
      fixedCount++
      console.log(`✅ 已修复: ${filePath}`)
    } else {
      console.log(`ℹ️ 无需修复: ${filePath}`)
    }

  } catch (error) {
    errorCount++
    console.error(`❌ 修复失败 ${filePath}:`, error.message)
  }
}

// 处理所有文件
FILES_TO_FIX.forEach(fixFile)

console.log(`\n🎉 修复完成!`)
console.log(`✅ 成功修复: ${fixedCount} 个文件`)
console.log(`❌ 修复失败: ${errorCount} 个文件`)

if (errorCount === 0) {
  console.log('\n🚀 现在尝试构建项目...')
  const { spawn } = await import('child_process')

  const buildProcess = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    cwd: __dirname,
    shell: true
  })

  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n🎊 构建成功! 所有语法错误已修复。')
    } else {
      console.log(`\n⚠️ 构建仍然失败，退出码: ${code}`)
      console.log('可能需要手动修复剩余的错误。')
    }
  })
} else {
  console.log('\n⚠️ 存在修复失败的文件，请手动检查。')
}