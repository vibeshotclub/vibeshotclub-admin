-- Vibe Shot Club Database Schema

-- ============================================
-- 标签表
-- ============================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('style', 'topic', 'tool', 'quality')),
  color VARCHAR(7) DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tags_type ON tags(type);

-- ============================================
-- 提示词表
-- ============================================
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,
  negative_prompt TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  author_name VARCHAR(100),
  author_wechat VARCHAR(100),
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'wechat', 'twitter')),
  model VARCHAR(100),
  is_featured BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompts_is_published ON prompts(is_published);
CREATE INDEX idx_prompts_is_featured ON prompts(is_featured);
CREATE INDEX idx_prompts_sort_order ON prompts(sort_order DESC);
CREATE INDEX idx_prompts_created_at ON prompts(created_at DESC);

-- ============================================
-- 提示词-标签关联表 (多对多)
-- ============================================
CREATE TABLE prompt_tags (
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (prompt_id, tag_id)
);

CREATE INDEX idx_prompt_tags_prompt ON prompt_tags(prompt_id);
CREATE INDEX idx_prompt_tags_tag ON prompt_tags(tag_id);

-- ============================================
-- 用户表 (Phase 2 预留)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wechat_openid VARCHAR(100) UNIQUE,
  phone VARCHAR(20),
  nickname VARCHAR(100),
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'guest' CHECK (role IN ('guest', 'member', 'creator', 'admin')),
  level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  points_balance INTEGER DEFAULT 0,
  points_total INTEGER DEFAULT 0,
  membership_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 自动更新 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 公开读取已发布的提示词
CREATE POLICY "Public can view published prompts" ON prompts
  FOR SELECT USING (is_published = true);

-- 公开读取标签
CREATE POLICY "Public can view tags" ON tags
  FOR SELECT USING (true);

-- 公开读取提示词-标签关联
CREATE POLICY "Public can view prompt_tags" ON prompt_tags
  FOR SELECT USING (true);

-- Service Role 可以执行所有操作 (Admin 后台使用)
-- 注意: service_role key 会自动绕过 RLS

-- ============================================
-- 初始标签数据 (可选)
-- ============================================
INSERT INTO tags (name, type, color) VALUES
  -- 风格标签
  ('赛博朋克', 'style', '#00ff88'),
  ('写实', 'style', '#4a90d9'),
  ('动漫', 'style', '#ff6b9d'),
  ('油画', 'style', '#d4a373'),
  ('水彩', 'style', '#87ceeb'),
  ('像素风', 'style', '#9b59b6'),
  -- 主题标签
  ('人像', 'topic', '#e74c3c'),
  ('风景', 'topic', '#27ae60'),
  ('建筑', 'topic', '#95a5a6'),
  ('科幻', 'topic', '#8e44ad'),
  ('奇幻', 'topic', '#f39c12'),
  -- 工具标签
  ('Midjourney', 'tool', '#1e90ff'),
  ('DALL-E', 'tool', '#00a67e'),
  ('Stable Diffusion', 'tool', '#a855f7'),
  ('Flux', 'tool', '#ff4500'),
  -- 质量标签
  ('精选', 'quality', '#ffd700'),
  ('热门', 'quality', '#ff6347');
