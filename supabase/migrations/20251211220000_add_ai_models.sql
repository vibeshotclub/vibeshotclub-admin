-- AI 图像生成模型表
CREATE TABLE ai_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('closed', 'open')),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_ai_models_category ON ai_models(category);
CREATE INDEX idx_ai_models_vendor ON ai_models(vendor);
CREATE INDEX idx_ai_models_is_active ON ai_models(is_active);
CREATE INDEX idx_ai_models_sort_order ON ai_models(sort_order);

-- 插入闭源模型数据
INSERT INTO ai_models (id, name, vendor, category, sort_order) VALUES
-- Midjourney
('midjourney-v7', 'Midjourney V7', 'Midjourney', 'closed', 100),
('midjourney-v6.1', 'Midjourney V6.1', 'Midjourney', 'closed', 99),
('midjourney-v6', 'Midjourney V6', 'Midjourney', 'closed', 98),
('midjourney-niji-6', 'Midjourney Niji 6', 'Midjourney', 'closed', 97),

-- Google
('nano-banana-pro', 'Nano Banana Pro (Gemini 3)', 'Google', 'closed', 95),
('nano-banana', 'Nano Banana (Gemini 2.5 Flash)', 'Google', 'closed', 94),
('imagen-4-ultra', 'Imagen 4 Ultra', 'Google', 'closed', 93),
('imagen-4', 'Imagen 4', 'Google', 'closed', 92),
('imagen-3', 'Imagen 3', 'Google', 'closed', 91),

-- OpenAI
('gpt-4o-image', 'GPT-4o Image', 'OpenAI', 'closed', 90),
('dall-e-3', 'DALL-E 3', 'OpenAI', 'closed', 89),
('dall-e-2', 'DALL-E 2', 'OpenAI', 'closed', 88),

-- Recraft
('recraft-v3', 'Recraft V3', 'Recraft', 'closed', 85),
('recraft-v2', 'Recraft V2', 'Recraft', 'closed', 84),

-- Ideogram
('ideogram-3', 'Ideogram 3.0', 'Ideogram', 'closed', 83),
('ideogram-2', 'Ideogram 2.0', 'Ideogram', 'closed', 82),
('ideogram-1', 'Ideogram 1.0', 'Ideogram', 'closed', 81),

-- ByteDance
('seedream-4', 'Seedream 4.0', 'ByteDance', 'closed', 80),
('seedream-3', 'Seedream 3.0', 'ByteDance', 'closed', 79),
('jimeng', '即梦 AI', 'ByteDance', 'closed', 78),
('doubao-image', '豆包', 'ByteDance', 'closed', 77),

-- Adobe
('firefly-3', 'Adobe Firefly 3', 'Adobe', 'closed', 75),
('firefly-2', 'Adobe Firefly 2', 'Adobe', 'closed', 74),

-- Anthropic
('claude-image', 'Claude Image', 'Anthropic', 'closed', 70),

-- 其他闭源
('leonardo-ai', 'Leonardo AI', 'Leonardo', 'closed', 65),
('playground-v3', 'Playground V3', 'Playground', 'closed', 64),
('runway-gen3', 'Runway Gen-3', 'Runway', 'closed', 63),
('kling-ai', 'Kling AI', 'Kuaishou', 'closed', 62),
('tongyi-wanxiang', '通义万相', 'Alibaba', 'closed', 61),
('wenxin-yige', '文心一格', 'Baidu', 'closed', 60),
('zhipu-cogview', '智谱 CogView', 'Zhipu AI', 'closed', 59);

-- 插入开源模型数据
INSERT INTO ai_models (id, name, vendor, category, sort_order) VALUES
-- Z-Image (Alibaba)
('z-image-turbo', 'Z-Image Turbo', 'Alibaba Tongyi-MAI', 'open', 50),
('z-image-base', 'Z-Image Base', 'Alibaba Tongyi-MAI', 'open', 49),
('z-image-edit', 'Z-Image Edit', 'Alibaba Tongyi-MAI', 'open', 48),

-- FLUX (Black Forest Labs)
('flux-1.1-pro', 'FLUX 1.1 Pro', 'Black Forest Labs', 'open', 45),
('flux-1-dev', 'FLUX.1 Dev', 'Black Forest Labs', 'open', 44),
('flux-1-schnell', 'FLUX.1 Schnell', 'Black Forest Labs', 'open', 43),

-- Stable Diffusion
('sd-3.5-large', 'Stable Diffusion 3.5 Large', 'Stability AI', 'open', 40),
('sd-3.5-medium', 'Stable Diffusion 3.5 Medium', 'Stability AI', 'open', 39),
('sd-3', 'Stable Diffusion 3', 'Stability AI', 'open', 38),
('sdxl-1.0', 'SDXL 1.0', 'Stability AI', 'open', 37),
('sdxl-turbo', 'SDXL Turbo', 'Stability AI', 'open', 36),
('sd-1.5', 'Stable Diffusion 1.5', 'Stability AI', 'open', 35),

-- 其他开源
('pixart-sigma', 'PixArt-Sigma', 'PixArt', 'open', 30),
('pixart-alpha', 'PixArt-Alpha', 'PixArt', 'open', 29),
('playground-v2.5', 'Playground V2.5', 'Playground', 'open', 28),
('kandinsky-3', 'Kandinsky 3', 'Sber AI', 'open', 27),
('kolors', 'Kolors', 'Kuaishou', 'open', 26),
('hunyuan-dit', 'HunyuanDiT', 'Tencent', 'open', 25),
('cogview-3', 'CogView-3', 'Zhipu AI', 'open', 24),
('wuerstchen', 'Würstchen', 'Stability AI', 'open', 23),

-- 社区模型
('animagine-xl', 'Animagine XL', 'Community', 'open', 15),
('pony-diffusion', 'Pony Diffusion', 'Community', 'open', 14),
('realvisxl', 'RealVisXL', 'Community', 'open', 13),
('dreamshaper-xl', 'DreamShaper XL', 'Community', 'open', 12),
('juggernaut-xl', 'Juggernaut XL', 'Community', 'open', 11);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_ai_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_models_updated_at
  BEFORE UPDATE ON ai_models
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_models_updated_at();
