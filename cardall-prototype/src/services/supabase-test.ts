import { supabase } from './supabase'

// 测试Supabase连接
export async function testSupabaseConnection() {
  console.log('🧪 Testing Supabase connection...')
  
  try {
    // 测试基础连接
    const { data, error } = await supabase
      .from('cards')
      .select('id')
      .limit(1)
    
    if (error) {
      console.error('❌ Supabase connection test failed:', error)
      return false
    }
    
    console.log('✅ Supabase connection test successful')
    return true
  } catch (error) {
    console.error('❌ Supabase connection test error:', error)
    return false
  }
}

// 测试认证状态
export async function testAuthStatus() {
  console.log('🧪 Testing authentication status...')
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Auth test failed:', error)
      return null
    }
    
    console.log('✅ Auth test successful, session:', session ? 'Active' : 'None')
    return session
  } catch (error) {
    console.error('❌ Auth test error:', error)
    return null
  }
}

// 测试数据库表结构
export async function testDatabaseSchema() {
  console.log('🧪 Testing database schema...')
  
  try {
    // 测试cards表
    const { data: cardsData, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .limit(1)
    
    if (cardsError) {
      console.error('❌ Cards table test failed:', cardsError)
      return false
    }
    
    // 测试users表
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
    
    if (usersError) {
      console.error('❌ Users table test failed:', usersError)
      return false
    }
    
    console.log('✅ Database schema test successful')
    return true
  } catch (error) {
    console.error('❌ Database schema test error:', error)
    return false
  }
}

// 运行所有测试
export async function runAllTests() {
  console.log('🧪 Running all Supabase tests...')
  
  const results = {
    connection: await testSupabaseConnection(),
    auth: await testAuthStatus(),
    schema: await testDatabaseSchema()
  }
  
  console.log('📊 Test results:', results)
  return results
}