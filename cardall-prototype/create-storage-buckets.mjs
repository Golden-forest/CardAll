/**
 * 创建Supabase存储桶
 * 用于CardEverything项目的文件存储
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://elwnpejlwkgdacaugvvd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzkxNTAsImV4cCI6MjA2ODkxNTE1MH0.XhVGgO2nf8uS1gC0V6jTMP0p0xN5KKV47t2rK2ncK90'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createStorageBuckets() {
  console.log('🪣 开始创建存储桶...')

  const buckets = [
    {
      name: 'card-images',
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    },
    {
      name: 'user-avatars',
      public: true,
      fileSizeLimit: 1048576, // 1MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif']
    }
  ]

  for (const bucket of buckets) {
    console.log(`\n📦 创建存储桶: ${bucket.name}`)

    try {
      // 检查桶是否已存在
      const { data: existingBucket, error: checkError } = await supabase.storage.getBucket(bucket.name)

      if (checkError && checkError.message.includes('Not found')) {
        // 桶不存在，创建新桶
        const { data, error } = await supabase.storage.createBucket(bucket.name, {
          public: bucket.public,
          fileSizeLimit: bucket.fileSizeLimit,
          allowedMimeTypes: bucket.allowedMimeTypes
        })

        if (error) {
          console.log(`❌ 创建失败: ${error.message}`)
        } else {
          console.log(`✅ 创建成功: ${bucket.name}`)

          // 设置桶的CORS策略
          try {
            await supabase.storage.from(bucket.name).setPublicUrlAccess(true)
            console.log(`✅ 公开访问已设置: ${bucket.name}`)
          } catch (corsError) {
            console.log(`⚠️  CORS设置失败: ${corsError.message}`)
          }
        }
      } else if (checkError) {
        console.log(`❌ 检查失败: ${checkError.message}`)
      } else {
        console.log(`✅ 桶已存在: ${bucket.name}`)
      }
    } catch (err) {
      console.log(`❌ 异常: ${err.message}`)
    }
  }

  console.log('\n==========================================')
  console.log('🎯 存储桶创建完成！')

  // 验证结果
  console.log('\n🔍 验证存储桶...')
  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.getBucket(bucket.name)
      if (error) {
        console.log(`❌ ${bucket.name}: ${error.message}`)
      } else {
        console.log(`✅ ${bucket.name}: 正常`)
      }
    } catch (err) {
      console.log(`❌ ${bucket.name}: 验证失败 - ${err.message}`)
    }
  }
}

// 运行存储桶创建
createStorageBuckets().catch(console.error)