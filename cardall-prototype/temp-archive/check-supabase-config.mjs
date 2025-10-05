/**
 * Supabase配置检查工具
 * 用于验证CardEverything项目的Supabase配置状态
 */

import { createClient } from '@supabase/supabase-js'

// 从环境变量获取配置
const supabaseUrl = 'https://elwnpejlwkgdacaugvvd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzkxNTAsImV4cCI6MjA2ODkxNTE1MH0.XhVGgO2nf8uS1gC0V6jTMP0p0xN5KKV47t2rK2ncK90'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSupabaseConfiguration() {
  console.log('🔍 开始检查Supabase配置...')
  console.log('📋 项目URL:', supabaseUrl)
  console.log('==========================================\n')

  // 1. 检查基本连接
  console.log('1. 🔌 检查基本连接...')
  try {
    const { data, error } = await supabase.from('cards').select('count', { count: 'exact', head: true })
    if (error) {
      console.log('❌ 基本连接失败:', error.message)
    } else {
      console.log('✅ 基本连接成功')
    }
  } catch (err) {
    console.log('❌ 连接异常:', err.message)
  }

  // 2. 检查用户表
  console.log('\n2. 👥 检查用户表...')
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true })
    if (error) {
      console.log('❌ 用户表访问失败:', error.message)
    } else {
      console.log('✅ 用户表可访问')
    }
  } catch (err) {
    console.log('❌ 用户表异常:', err.message)
  }

  // 3. 检查认证状态
  console.log('\n3. 🔐 检查认证状态...')
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.log('❌ 认证检查失败:', error.message)
    } else {
      console.log('✅ 认证服务正常')
      console.log('📊 当前会话:', data.session ? '已登录' : '未登录')
    }
  } catch (err) {
    console.log('❌ 认证异常:', err.message)
  }

  // 4. 检查Realtime连接
  console.log('\n4. 📡 检查Realtime功能...')
  try {
    const channel = supabase.channel('test')
    channel.on('system', { event: 'connected' }, () => {
      console.log('✅ Realtime连接成功')
    })
    channel.subscribe()

    // 等待连接
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('✅ Realtime功能可用')
  } catch (err) {
    console.log('❌ Realtime异常:', err.message)
  }

  // 5. 检查存储桶
  console.log('\n5. 📁 检查存储桶...')
  try {
    const { data, error } = await supabase.storage.getBucket('card-images')
    if (error) {
      console.log('⚠️  card-images存储桶:', error.message)
    } else {
      console.log('✅ card-images存储桶存在')
    }
  } catch (err) {
    console.log('⚠️  card-images存储桶检查异常:', err.message)
  }

  try {
    const { data, error } = await supabase.storage.getBucket('user-avatars')
    if (error) {
      console.log('⚠️  user-avatars存储桶:', error.message)
    } else {
      console.log('✅ user-avatars存储桶存在')
    }
  } catch (err) {
    console.log('⚠️  user-avatars存储桶检查异常:', err.message)
  }

  // 6. 检查数据库表结构
  console.log('\n6. 🗂️  检查数据库表结构...')
  const tables = ['cards', 'folders', 'tags', 'images', 'users']

  for (const tableName of tables) {
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(1)
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`✅ ${tableName}表存在 (空表)`)
        } else {
          console.log(`❌ ${tableName}表错误:`, error.message)
        }
      } else {
        console.log(`✅ ${tableName}表存在且有数据`)
      }
    } catch (err) {
      console.log(`❌ ${tableName}表异常:`, err.message)
    }
  }

  // 7. 检查RLS策略
  console.log('\n7. 🔒 检查行级安全策略...')
  try {
    // 尝试插入测试数据来检查RLS
    const { data, error } = await supabase.from('cards').insert({
      front_content: { test: true },
      back_content: { test: true }
    }).select()

    if (error) {
      if (error.code === '42501') {
        console.log('✅ RLS策略已启用 (阻止未授权插入)')
      } else {
        console.log('⚠️  RLS检查异常:', error.message)
      }
    } else {
      console.log('⚠️  可能需要配置RLS策略')
      // 清理测试数据
      if (data && data.length > 0) {
        await supabase.from('cards').delete().eq('id', data[0].id)
      }
    }
  } catch (err) {
    console.log('❌ RLS检查异常:', err.message)
  }

  console.log('\n==========================================')
  console.log('🎯 检查完成！')
  console.log('\n📝 建议:')
  console.log('1. 确保所有必需的表都已创建')
  console.log('2. 启用Realtime功能')
  console.log('3. 配置适当的RLS策略')
  console.log('4. 创建必要的存储桶')
  console.log('5. 测试用户注册和登录流程')
}

// 运行检查
checkSupabaseConfiguration().catch(console.error)