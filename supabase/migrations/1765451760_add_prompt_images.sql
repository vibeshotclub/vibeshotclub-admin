-- 提示词图片表 (支持多图)
CREATE TABLE prompt_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompt_images_prompt ON prompt_images(prompt_id);
CREATE INDEX idx_prompt_images_sort ON prompt_images(prompt_id, sort_order);

-- RLS
ALTER TABLE prompt_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view prompt_images" ON prompt_images
  FOR SELECT USING (true);

-- 迁移现有数据: 将 prompts 表的 image_url 迁移到 prompt_images
INSERT INTO prompt_images (prompt_id, image_url, thumbnail_url, sort_order)
SELECT id, image_url, thumbnail_url, 0
FROM prompts
WHERE image_url IS NOT NULL AND image_url != '';
