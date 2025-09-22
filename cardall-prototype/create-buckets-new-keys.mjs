/**
 * 使用新的Service Role Key创建存储桶
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://elwnpejlwkgdacaugvvd.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzMzOTE1MCwiZXhwIjoyMDY4OTE1MTUwfQ.AB1POaGqeRpD9tYHXSkmzrdwVe3MdEJ9Xu35EjHtRXU'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
})

async function createBucketsWithNewKeys() {
  console.log('🔑 使用新的Service Role Key创建存储桶...')
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

            // 设置桶策略
            try {
              await new Promise(resolve => setTimeout(resolve, 1000)) // 等待桶创建完成
              console.log(`  🔒 设置访问权限...`)

              // 为存储桶设置公开访问策略
              const { error: policyError } = await supabase.storage.from(bucket.name).setPublicUrlAccess(true)

              if (policyError) {
                console.log(`  ⚠️  权限设置警告: ${policyError.message}`)
              } else {
                console.log(`  ✅ 权限设置成功`)
              }
            } catch (policyErr) {
              console.log(`  ⚠️  权限设置异常: ${policyErr.message}`)
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

  // 验证所有桶
  console.log('🔍 验证存储桶创建结果...')
  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.getBucket(bucket.name)
      if (error) {
        console.log(`❌ ${bucket.name}: ${error.message}`)
      } else {
        console.log(`✅ ${bucket.name}: 存在并正常`)
        console.log(`   公开访问: ${data.public ? '是' : '否'}`)
        console.log(`   文件大小限制: ${data.file_size_limit} bytes`)
        if (data.allowed_mime_types) {
          console.log(`   允许的文件类型: ${data.allowed_mime_types.join(', ')}`)
        }
      }
    } catch (err) {
      console.log(`❌ ${bucket.name}: 验证失败 - ${err.message}`)
    }
  }

  console.log('\n==========================================')
  console.log('🎯 存储桶创建操作完成!')
  console.log('\n📝 后续步骤:')
  console.log('1. 如果创建失败，请手动在Supabase Dashboard创建')
  console.log('2. 确保存储桶设置为公开访问')
  console.log('3. 测试文件上传功能')
}

// 执行创建
createBucketsWithNewKeys().catch(console.error)