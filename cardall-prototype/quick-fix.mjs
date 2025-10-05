#!/usr/bin/env node

/**
 * 快速语法修复脚本
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🔧 开始快速修复...')

// 修复 auth.ts
try {
  const authPath = path.join(__dirname, 'src/services/auth.ts')
  if (fs.existsSync(authPath)) {
    let content = fs.readFileSync(authPath, 'utf-8')

    // 修复 catch 块语法错误
    content = content.replace(
      /} catch \(error\) {\s*console\.warn\(`操作失败 \(attempt \${attempt}\/\${maxRetries}\):`, error\)\s*if \(attempt < maxRetries\) {/g,
      '} catch (error) {\n          console.warn(`操作失败 (attempt ${attempt}/${maxRetries}):`, error)\n        if (attempt < maxRetries) {'
    )

    // 修复其他常见错误
    content = content.replace(
      /console\.warn\("操作失败:", error\)\s*}\/\$\{maxRetries\}\):`, error\)/g,
      'console.warn(`操作失败 (attempt ${attempt}/${maxRetries}):`, error)'
    )

    fs.writeFileSync(authPath, content, 'utf-8')
    console.log('✅ 修复 auth.ts')
  }
} catch (error) {
  console.error('❌ 修复 auth.ts 失败:', error.message)
}

// 修复 event-system.ts
try {
  const eventPath = path.join(__dirname, 'src/services/event-system.ts')
  if (fs.existsSync(eventPath)) {
    let content = fs.readFileSync(eventPath, 'utf-8')

    // 修复多余 export
    content = content.replace(/export export/g, 'export')

    // 修复 console.warn 错误
    content = content.replace(
      /console\.warn\("操作失败:", error\)\s*}":`, error\)/g,
      'console.warn(`Event handler failed for "${eventName}":`, error)'
    )

    fs.writeFileSync(eventPath, content, 'utf-8')
    console.log('✅ 修复 event-system.ts')
  }
} catch (error) {
  console.error('❌ 修复 event-system.ts 失败:', error.message)
}

console.log('🎉 快速修复完成!')
console.log('🚀 尝试构建...')

const { spawn } = await import('child_process')

const buildProcess = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  cwd: __dirname,
  shell: true
})

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n🎊 构建成功!')
  } else {
    console.log(`\n⚠️ 构建失败，退出码: ${code}`)
  }
})