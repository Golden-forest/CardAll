/**
 * 直接使用新的Service Role Key创建存储桶
 * 通过SQL命令创建存储桶
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://elwnpejlwkgdacaugvvd.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzMzOTE1MCwiZXhwIjoyMDY4OTE1MTUwfQ.AB1POaGqeRpD9tYHXSkmzrdwVe3MdEJ9Xu35EjHtRXU'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
})

async function createBucketsWithSQL() {
  console.log('🔧 使用SQL命令创建存储桶...')
  console.log('📋 项目URL:', supabaseUrl)
  console.log('==========================================\n')

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
    console.log(`🪣 处理存储桶: ${bucket.name}`)

    try {
      // 首先检查桶是否存在
      console.log(`  🔍 检查是否存在...`)
      const { data: existingBucket, error: checkError } = await supabase.storage.getBucket(bucket.name)

      if (checkError && (checkError.message.includes('Not found') || checkError.statusCode === 404)) {
        console.log(`  📦 存储桶不存在，正在创建...`)

        // 使用SQL创建存储桶
        const sql = `
          INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at)
          VALUES (
            gen_random_uuid(),
            '${bucket.name}',
            ${bucket.public},
            ${bucket.fileSizeLimit},
            ARRAY[${bucket.allowedMimeTypes.map(m => `'${m}'`).join(', ')}],
            NOW()
          )
          ON CONFLICT (name) DO NOTHING
          RETURNING id, name, public, file_size_limit, allowed_mime_types;
        `

        const { data: insertData, error: insertError } = await supabase.rpc('exec_sql', { sql })

        if (insertError) {
          // 尝试使用REST API方式
          console.log(`  🔄 尝试使用存储API创建...`)
          const { data, error } = await supabase.storage.createBucket(bucket.name, {
            public: bucket.public,
            fileSizeLimit: bucket.fileSizeLimit,
            allowedMimeTypes: bucket.allowedMimeTypes
          })

          if (error) {
            console.log(`  ❌ 创建失败: ${error.message}`)
            console.log(`     错误代码: ${error.code}`)
          } else {
            console.log(`  ✅ 创建成功!`)
            console.log(`     📊 桶信息:`, data)
          }
        } else {
          console.log(`  ✅ SQL创建成功!`)
          console.log(`     📊 桶信息:`, insertData)
        }
      } else if (checkError) {
        console.log(`  ❌ 检查失败: ${checkError.message}`)
      } else {
        console.log(`  ✅ 存储桶已存在`)
        console.log(`     📊 桶信息:`, existingBucket)
      }
    } catch (err) {
      console.log(`  ❌ 异常: ${err.message}`)
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
      console.log(`❌ ${bucket.name}: 验证失败 - ${err.message}`)
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
createBucketsWithSQL().catch(console.error)