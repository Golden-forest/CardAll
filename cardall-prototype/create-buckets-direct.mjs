/**
 * 直接使用Supabase JavaScript SDK创建存储桶
 * 使用项目配置文件中的凭据
 */

import { createClient } from '@supabase/supabase-js'

// 从项目配置中获取
const supabaseUrl = 'https://elwnpejlwkgdacaugvvd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzkxNTAsImV4cCI6MjA2ODkxNTE1MH0.XhVGgO2nf8uS1gC0V6jTMP0p0xN5KKV47t2rK2ncK90'

// 使用匿名密钥创建客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createBucketsDirectly() {
  console.log('🔧 直接使用Supabase SDK创建存储桶...')
  console.log('📋 项目URL:', supabaseUrl)
  console.log('==========================================\n')

  const buckets = [
    {
      name: 'card-images',
      options: {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      }
    },
    {
      name: 'user-avatars',
      options: {
        public: true,
        fileSizeLimit: 1048576, // 1MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif']
      }
    }
  ]

  for (const bucket of buckets) {
    console.log(`🪣 处理存储桶: ${bucket.name}`)

    try {
      // 检查桶是否存在
      console.log(`  🔍 检查是否存在...`)
      const { data: existingBucket, error: checkError } = await supabase.storage.getBucket(bucket.name)

      if (checkError) {
        if (checkError.message.includes('Not found') || checkError.statusCode === 404) {
          console.log(`  📦 存储桶不存在，正在创建...`)
          console.log(`     📋 配置:`, bucket.options)

          // 创建存储桶
          const { data, error } = await supabase.storage.createBucket(bucket.name, bucket.options)

          if (error) {
            console.log(`  ❌ 创建失败: ${error.message}`)
            console.log(`     错误代码: ${error.code}`)
            console.log(`     错误详情:`, error)
          } else {
            console.log(`  ✅ 创建成功!`)
            console.log(`     📊 桶信息:`, data)

            // 验证创建结果
            await new Promise(resolve => setTimeout(resolve, 1000))
            const { data: verifyData, error: verifyError } = await supabase.storage.getBucket(bucket.name)
            if (verifyError) {
              console.log(`  ⚠️  验证失败: ${verifyError.message}`)
            } else {
              console.log(`  ✅ 验证成功: 桶已正常创建`)
            }
          }
        } else {
          console.log(`  ❌ 检查失败: ${checkError.message}`)
          console.log(`     错误详情:`, checkError)
        }
      } else {
        console.log(`  ✅ 存储桶已存在`)
        console.log(`     📊 桶信息:`, existingBucket)
      }
    } catch (err) {
      console.log(`  ❌ 异常: ${err.message}`)
      console.log(`     异常详情:`, err)
    }

    console.log('') // 空行分隔
  }

  // 最终验证
  console.log('🔍 最终验证...')
  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.getBucket(bucket.name)
      if (error) {
        console.log(`❌ ${bucket.name}: ${error.message}`)
      } else {
        console.log(`✅ ${bucket.name}: 创建成功`)
        console.log(`   公开访问: ${data.public ? '是' : '否'}`)
        console.log(`   文件大小限制: ${data.file_size_limit} bytes`)
        if (data.allowed_mime_types) {
          console.log(`   允许的文件类型: ${data.allowed_mime_types.join(', ')}`)
        }
      }
    } catch (err) {
      console.log(`❌ ${bucket.name}: 验证异常 - ${err.message}`)
    }
  }

  console.log('\n==========================================')
  console.log('🎯 存储桶创建操作完成!')
  console.log('\n📝 如果自动创建失败，请手动在Supabase Dashboard创建:')
  console.log('1. 访问: https://supabase.com/dashboard')
  console.log('2. 选择项目: elwnpejlwkgdacaugvvd')
  console.log('3. 进入 Storage 部分')
  console.log('4. 创建新存储桶:')
  console.log('   - 名称: card-images')
  console.log('   - 公开访问: 是')
  console.log('   - 文件大小限制: 5MB')
  console.log('   - 创建第二个存储桶:')
  console.log('   - 名称: user-avatars')
  console.log('   - 公开访问: 是')
  console.log('   - 文件大小限制: 1MB')
}

// 执行创建
createBucketsDirectly().catch(console.error)