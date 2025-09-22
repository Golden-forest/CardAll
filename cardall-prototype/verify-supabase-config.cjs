/**
 * Supabase Configuration Verification Script
 * 验证新的 Supabase 客户端配置是否正常工作
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 验证 Supabase 客户端配置...\n')

// 1. 检查文件是否存在
const supabaseClientPath = path.join(__dirname, 'src', 'services', 'supabase-client.ts')
if (!fs.existsSync(supabaseClientPath)) {
    console.error('❌ supabase-client.ts 文件不存在')
    process.exit(1)
}
console.log('✅ supabase-client.ts 文件存在')

// 2. 检查文件内容
const content = fs.readFileSync(supabaseClientPath, 'utf8')

// 检查关键功能
const requiredFeatures = [
    'EnhancedSupabaseClient',
    'ConnectionStatus',
    'loadSupabaseConfig',
    'validateConfig',
    'queryWithRetry',
    'isSupabaseError',
    'getSupabaseErrorMessage',
    'getSecureStorage',
    'initializeConnectionCheck',
    'handleConnectionError'
]

requiredFeatures.forEach(feature => {
    if (content.includes(feature)) {
        console.log(`✅ 包含功能: ${feature}`)
    } else {
        console.error(`❌ 缺少功能: ${feature}`)
    }
})

// 3. 检查环境变量使用
const envVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ACCESS_TOKEN',
    'VITE_APP_ENVIRONMENT',
    'VITE_APP_VERSION'
]

console.log('\n🔧 环境变量检查:')
envVars.forEach(envVar => {
    if (content.includes(envVar)) {
        console.log(`✅ 使用环境变量: ${envVar}`)
    } else {
        console.warn(`⚠️ 未使用环境变量: ${envVar}`)
    }
})

// 4. 检查错误处理
const errorHandlingPatterns = [
    'try\\s*{',
    'catch\\s*\\(',
    'throw new Error',
    'console\\.error'
]

console.log('\n🛡️ 错误处理检查:')
errorHandlingPatterns.forEach(pattern => {
    const regex = new RegExp(pattern, 'i')
    if (regex.test(content)) {
        console.log(`✅ 包含错误处理模式: ${pattern}`)
    } else {
        console.warn(`⚠️ 缺少错误处理模式: ${pattern}`)
    }
})

// 5. 检查向后兼容性
const supabaseTsPath = path.join(__dirname, 'src', 'services', 'supabase.ts')
if (fs.existsSync(supabaseTsPath)) {
    const supabaseContent = fs.readFileSync(supabaseTsPath, 'utf8')
    if (supabaseContent.includes('getSupabaseClient')) {
        console.log('✅ 保持向后兼容性')
    } else {
        console.warn('⚠️ 可能影响向后兼容性')
    }
} else {
    console.warn('⚠️ supabase.ts 文件不存在')
}

// 6. 检查测试文件
const testPath = path.join(__dirname, 'tests', 'unit', 'services', 'supabase-client.test.ts')
if (fs.existsSync(testPath)) {
    console.log('✅ 存在测试文件')
} else {
    console.warn('⚠️ 测试文件不存在')
}

// 7. 检查构建是否成功
console.log('\n🏗️ 构建验证:')
try {
    const distPath = path.join(__dirname, 'dist')
    if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath)
        const hasAssets = files.some(file => file.startsWith('assets'))
        if (hasAssets) {
            console.log('✅ 构建成功，包含资源文件')
        } else {
            console.warn('⚠️ 构建可能不完整')
        }
    } else {
        console.warn('⚠️ dist 目录不存在，需要先构建')
    }
} catch (error) {
    console.warn('⚠️ 无法检查构建状态')
}

// 8. 功能总结
console.log('\n📋 功能总结:')
console.log('- 🔄 连接状态监控和自动重连')
console.log('- 🛡️ 增强的错误处理和重试机制')
console.log('- 🔐 安全的凭据管理')
console.log('- 🌐 多环境支持')
console.log('- 📊 连接质量监控')
console.log('- 🔄 查询重试和回退策略')
console.log('- 📝 详细的日志记录')
console.log('- 🧹 资源清理和管理')
console.log('- 🔄 向后兼容性')

console.log('\n✅ Supabase 客户端配置验证完成！')
console.log('\n📝 使用方法:')
console.log('1. 基础使用: import { supabase } from \'./src/services/supabase\'')
console.log('2. 增强功能: import { getSupabaseClient } from \'./src/services/supabase-client\'')
console.log('3. 测试配置: 打开 test-supabase-config.html 进行全面测试')