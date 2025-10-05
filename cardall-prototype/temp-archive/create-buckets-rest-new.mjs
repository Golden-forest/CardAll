/**
 * 使用新的令牌通过REST API创建存储桶
 */

const supabaseUrl = 'https://elwnpejlwkgdacaugvvd.supabase.co'
const accessToken = 'sbp_0c55c1f182a3c3502a245ed3eb3e90d17285bb73'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzMzOTE1MCwiZXhwIjoyMDY4OTE1MTUwfQ.AB1POaGqeRpD9tYHXSkmzrdwVe3MdEJ9Xu35EjHtRXU'

async function createBucketViaAPI(bucketName, options) {
  const url = `${supabaseUrl}/storage/v1/bucket`

  const payload = {
    name: bucketName,
    public: options.public || false,
    file_size_limit: options.fileSizeLimit,
    allowed_mime_types: options.allowedMimeTypes || []
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const result = await response.json()
  return {
    status: response.status,
    data: result,
    ok: response.ok
  }
}

async function checkBucketExists(bucketName) {
  const url = `${supabaseUrl}/storage/v1/bucket/${bucketName}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    }
  })

  return {
    status: response.status,
    exists: response.status === 200,
    data: response.ok ? await response.json() : null
  }
}

async function createStorageBucketsREST() {
  console.log('🌐 使用新的令牌通过REST API创建存储桶...')
  console.log('📋 项目URL:', supabaseUrl)
  console.log('==========================================\\n')

  const buckets = [
    {
      name: 'card-images',
      options: {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      }
    },
    {
      name: 'user-avatars',
      options: {
        public: true,
        fileSizeLimit: 1048576,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif']
      }
    }
  ]

  for (const bucket of buckets) {
    console.log(`🪣 处理存储桶: ${bucket.name}`)

    try {
      // 检查是否存在
      console.log(`  🔍 检查是否存在...`)
      const checkResult = await checkBucketExists(bucket.name)

      if (checkResult.exists) {
        console.log(`  ✅ 存储桶已存在`)
        console.log(`     📊 桶信息:`, checkResult.data)
      } else {
        console.log(`  📦 存储桶不存在，正在创建...`)
        console.log(`     📋 配置:`, bucket.options)

        const createResult = await createBucketViaAPI(bucket.name, bucket.options)

        if (createResult.ok) {
          console.log(`  ✅ 创建成功!`)
          console.log(`     📊 响应:`, createResult.data)
        } else {
          console.log(`  ❌ 创建失败: ${createResult.status}`)
          console.log(`     错误详情:`, createResult.data)
        }
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
      const result = await checkBucketExists(bucket.name)
      if (result.exists) {
        console.log(`✅ ${bucket.name}: 创建成功`)
      } else {
        console.log(`❌ ${bucket.name}: 创建失败`)
      }
    } catch (err) {
      console.log(`❌ ${bucket.name}: 验证异常 - ${err.message}`)
    }
  }

  console.log('\\n==========================================')
  console.log('🎯 REST API存储桶创建操作完成!')
  console.log('\\n📝 如果自动创建失败，请手动在Supabase Dashboard创建:')
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
createStorageBucketsREST().catch(console.error)