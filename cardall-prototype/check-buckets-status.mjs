/**
 * 检查存储桶状态
 * 使用REST API检查存储桶是否真的创建成功
 */

const supabaseUrl = 'https://elwnpejlwkgdacaugvvd.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzMzOTE1MCwiZXhwIjoyMDY4OTE1MTUwfQ.AB1POaGqeRpD9tYHXSkmzrdwVe3MdEJ9Xu35EjHtRXU'

async function checkBucketsStatus() {
  console.log('🔍 检查存储桶状态...')
  console.log('📋 项目URL:', supabaseUrl)
  console.log('==========================================\n')

  const buckets = ['card-images', 'user-avatars']

  for (const bucketName of buckets) {
    console.log(`🪣 检查存储桶: ${bucketName}`)

    try {
      // 使用REST API检查
      const url = `${supabaseUrl}/storage/v1/bucket/${bucketName}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 200) {
        const bucketInfo = await response.json()
        console.log(`  ✅ 存储桶存在`)
        console.log(`     名称: ${bucketInfo.name}`)
        console.log(`     公开访问: ${bucketInfo.public ? '是' : '否'}`)
        console.log(`     文件大小限制: ${bucketInfo.file_size_limit} bytes`)
        if (bucketInfo.allowed_mime_types) {
          console.log(`     允许的文件类型: ${bucketInfo.allowed_mime_types.join(', ')}`)
        }
      } else if (response.status === 404) {
        console.log(`  ❌ 存储桶不存在`)
        console.log(`     状态码: ${response.status}`)

        // 重新创建
        console.log(`  🔄 尝试重新创建...`)
        const createUrl = `${supabaseUrl}/storage/v1/bucket`
        const payload = {
          name: bucketName,
          public: true,
          file_size_limit: bucketName === 'card-images' ? 5242880 : 1048576,
          allowed_mime_types: bucketName === 'card-images'
            ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
            : ['image/jpeg', 'image/png', 'image/gif']
        }

        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        if (createResponse.ok) {
          console.log(`  ✅ 重新创建成功`)
        } else {
          console.log(`  ❌ 重新创建失败: ${createResponse.status}`)
        }
      } else {
        console.log(`  ❌ 检查失败: ${response.status}`)
        const errorText = await response.text()
        console.log(`     错误信息: ${errorText}`)
      }

    } catch (err) {
      console.log(`  ❌ 检查异常: ${err.message}`)
    }

    console.log('') // 空行分隔
  }

  console.log('==========================================')
  console.log('🎯 存储桶状态检查完成!')
}

// 执行检查
checkBucketsStatus().catch(console.error)