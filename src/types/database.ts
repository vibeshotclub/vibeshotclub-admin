export type PromptSource = 'manual' | 'wechat' | 'twitter'
export type UserRole = 'guest' | 'member' | 'creator' | 'admin'

// 标签组/分类
export interface TagType {
  id: string
  name: string
  slug: string
  color: string
  sort_order: number
  created_at: string
}

export interface TagTypeFormData {
  name: string
  slug: string
  color: string
}

export interface Tag {
  id: string
  name: string
  type: string // slug of tag_type for backward compatibility
  type_id: string | null
  color: string
  created_at: string
  tag_type?: TagType // joined data
}

export interface PromptImage {
  id: string
  prompt_id: string
  image_url: string
  thumbnail_url: string | null
  sort_order: number
  created_at: string
}

export interface Prompt {
  id: string
  title: string
  description: string | null
  prompt_text: string
  negative_prompt: string | null
  image_url: string
  thumbnail_url: string | null
  author_name: string | null
  author_wechat: string | null
  source: PromptSource
  model: string | null
  is_featured: boolean
  is_published: boolean
  sort_order: number
  view_count: number
  created_at: string
  updated_at: string
}

export interface PromptWithTags extends Prompt {
  tags: Tag[]
  images?: PromptImage[]
}

export interface PromptTag {
  prompt_id: string
  tag_id: string
}

export interface User {
  id: string
  wechat_openid: string | null
  phone: string | null
  nickname: string | null
  avatar_url: string | null
  role: UserRole
  level: number
  points_balance: number
  points_total: number
  membership_expires_at: string | null
  created_at: string
  updated_at: string
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Form Types
export interface ImageData {
  image_url: string
  thumbnail_url?: string
}

export interface PromptFormData {
  title: string
  description?: string
  prompt_text: string
  negative_prompt?: string
  image_url: string
  thumbnail_url?: string
  images: ImageData[]
  author_name?: string
  author_wechat?: string
  source: PromptSource
  model?: string
  is_featured: boolean
  is_published: boolean
  tag_ids: string[]
}

export interface TagFormData {
  name: string
  type_id: string
  color: string
}

// AI 模型
export type AIModelCategory = 'closed' | 'open'

export interface AIModel {
  id: string
  name: string
  vendor: string
  category: AIModelCategory
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
