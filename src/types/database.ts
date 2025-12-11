export type TagType = 'style' | 'topic' | 'tool' | 'quality'
export type PromptSource = 'manual' | 'wechat' | 'twitter'
export type UserRole = 'guest' | 'member' | 'creator' | 'admin'

export interface Tag {
  id: string
  name: string
  type: TagType
  color: string
  created_at: string
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
  type: TagType
  color: string
}
