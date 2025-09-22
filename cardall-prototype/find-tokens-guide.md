# Supabase 令牌获取指南

## 1. 获取 Service Role Key (用于创建存储桶)

### 步骤：
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目：`elwnpejlwkgdacaugvvd`
3. 进入 **Settings** > **API**
4. 在 **Project API keys** 部分
5. 找到 **service_role** 密钥
6. 点击复制按钮获取密钥

### Service Role Key 格式：
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzMzOTE1MCwiZXhwIjoyMDY4OTE1MTUwfQ...
```

## 2. 获取 Access Token (用于 MCP)

### 方法一：从个人设置获取
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 点击右上角头像
3. 进入 **Account Settings**
4. 找到 **Access Tokens**
5. 创建新的 access token

### 方法二：从项目设置获取
1. 在项目Dashboard中
2. 进入 **Settings** > **API**
3. 找到 **Configuration** 部分
4. 可能能找到 access token

### Access Token 格式：
```
sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 3. 验证令牌

### 验证 Service Role Key：
创建一个测试脚本：
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://elwnpejlwkgdacaugvvd.supabase.co'
const serviceRoleKey = 'YOUR_SERVICE_ROLE_KEY_HERE'

const supabase = createClient(supabaseUrl, serviceRoleKey)

// 测试创建存储桶
async function test() {
  const { data, error } = await supabase.storage.createBucket('test-bucket', {
    public: true,
    fileSizeLimit: 1024
  })

  if (error) {
    console.log('Error:', error.message)
  } else {
    console.log('Success:', data)
  }
}
```

### 验证 Access Token：
在命令行中设置：
```bash
export SUPABASE_ACCESS_TOKEN=your_access_token_here
```

## 4. 令牌权限说明

- **Service Role Key**: 完全管理员权限，可以创建存储桶、修改数据库结构
- **Access Token**: API 访问权限，用于 MCP 连接
- **Anon Key**: 匿名访问权限，有限制的操作权限

## 5. 安全注意事项

⚠️ **重要提醒**：
- Service Role Key 拥有完全管理员权限，不要泄露
- Access Token 也需要妥善保管
- 这些令牌应该只用于开发环境
- 不要将这些令牌提交到版本控制系统

## 6. 当前已知令牌状态

- **项目URL**: `https://elwnpejlwkgdacaugvvd.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzkxNTAsImV4cCI6MjA2ODkxNTE1MH0.XhVGgO2nf8uS1gC0V6jTMP0p0xN5KKV47t2rK2ncK90`
- **之前的 Access Token**: `sbp_e95c8cedf56ad231cb00db4c2696b029c20cefda` (可能已过期)

## 7. 获取新令牌后

获取到新的令牌后，我可以：
1. 配置 Supabase MCP 连接
2. 创建所需的存储桶
3. 验证云端同步功能

---

**请按照上述步骤找到相应的令牌，然后提供给我进行配置。**