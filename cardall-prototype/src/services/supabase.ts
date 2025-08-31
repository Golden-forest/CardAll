import { createClient } from '@supabase/supabase-js'

// Supabase配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

// 创建Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// 数据库类型定义
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          github_id: string
          email: string
          username: string
          avatar_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          github_id: string
          email: string
          username: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          github_id?: string
          email?: string
          username?: string
          avatar_url?: string
          updated_at?: string
        }
      }
      cards: {
        Row: {
          id: string
          user_id: string
          front_content: any
          back_content: any
          style: any
          folder_id: string | null
          created_at: string
          updated_at: string
          sync_version: number
          is_deleted: boolean
        }
        Insert: {
          id?: string
          user_id: string
          front_content: any
          back_content: any
          style: any
          folder_id?: string | null
          created_at?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          front_content?: any
          back_content?: any
          style?: any
          folder_id?: string | null
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
      }
      folders: {
        Row: {
          id: string
          user_id: string
          name: string
          parent_id: string | null
          created_at: string
          updated_at: string
          sync_version: number
          is_deleted: boolean
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          parent_id?: string | null
          created_at?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
          updated_at: string
          sync_version: number
          is_deleted: boolean
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          created_at?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
      }
      images: {
        Row: {
          id: string
          user_id: string
          card_id: string
          file_name: string
          file_path: string
          cloud_url: string | null
          metadata: any
          created_at: string
          updated_at: string
          sync_version: number
          is_deleted: boolean
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          file_name: string
          file_path: string
          cloud_url?: string | null
          metadata?: any
          created_at?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          file_name?: string
          file_path?: string
          cloud_url?: string | null
          metadata?: any
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
      }
    }
  }
}

// 认证相关类型
export interface User {
  id: string
  github_id: string
  email: string
  username: string
  avatar_url: string
  created_at: string
  updated_at: string
}

// 同步状态类型
export interface SyncStatus {
  isOnline: boolean
  lastSyncTime: Date | null
  pendingOperations: number
  syncInProgress: boolean
  hasConflicts: boolean
}

// 导出类型化的Supabase客户端
export type SupabaseClient = typeof supabase