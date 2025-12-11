-- ============================================
-- 标签组表 (Tag Types / Categories)
-- ============================================
CREATE TABLE tag_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tag_types_sort ON tag_types(sort_order);

-- 插入默认标签组（从原有硬编码迁移）
INSERT INTO tag_types (name, slug, color, sort_order) VALUES
  ('风格', 'style', '#8b5cf6', 1),
  ('主题', 'topic', '#10b981', 2),
  ('工具', 'tool', '#f59e0b', 3),
  ('质量', 'quality', '#ef4444', 4);

-- 修改 tags 表：移除 CHECK 约束，改为外键关联
-- 先添加新列
ALTER TABLE tags ADD COLUMN type_id UUID;

-- 更新现有数据，关联到新的 tag_types
UPDATE tags SET type_id = (SELECT id FROM tag_types WHERE slug = tags.type);

-- 设置外键约束
ALTER TABLE tags ADD CONSTRAINT fk_tags_type
  FOREIGN KEY (type_id) REFERENCES tag_types(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX idx_tags_type_id ON tags(type_id);

-- RLS for tag_types
ALTER TABLE tag_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view tag_types"
  ON tag_types FOR SELECT USING (true);

CREATE POLICY "Admin can manage tag_types"
  ON tag_types FOR ALL USING (true);
