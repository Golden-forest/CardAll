#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const authPath = path.join(__dirname, 'src/services/auth.ts')

console.log('🔧 修复 auth.ts 文件...')

try {
  let content = fs.readFileSync(authPath, 'utf-8')

  // 修复所有的 catch 块语法错误
  content = content.replace(
    /} catch \(error\) {\s*console\.warn\("操作失败:", error\)\s*}\s*return \{ error: error as AuthError \}\s*}\s*}/g,
    '} catch (error) {\n          console.warn("操作失败:", error)\n        return { error: error as AuthError }\n    }\n  }'
  )

  // 修复其他可能的语法错误
  content = content.replace(
    /console\.warn\("操作失败:", error\)\s*}\s*return \{ error: error as AuthError \}\s*}\s*}/g,
    'console.warn("操作失败:", error)\n        return { error: error as AuthError }\n    }\n  }'
  )

  fs.writeFileSync(authPath, content, 'utf-8')
  console.log('✅ 修复完成')

} catch (error) {
  console.error('❌ 修复失败:', error.message)
}

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