import { getSupabaseClient } from './supabase-client'

// 导出增强的 Supabase 客户端以保持向后兼容性
export const supabase = getSupabaseClient().getClient()

// 导出增强功能
export { getSupabaseClient } from './supabase-client'
export type { ConnectionStatus } from './supabase-client'
export { isSupabaseError, getSupabaseErrorMessage } from './supabase-client'

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