// AI 图像生成模型列表
// 后续可迁移到数据库管理

export interface AIModel {
  id: string
  name: string
  vendor: string
  category: 'closed' | 'open'  // closed = 闭源, open = 开源
  isActive: boolean
}

export const AI_MODELS: AIModel[] = [
  // === 闭源模型 ===
  // Midjourney
  { id: 'midjourney-v6.1', name: 'Midjourney v6.1', vendor: 'Midjourney', category: 'closed', isActive: true },
  { id: 'midjourney-v6', name: 'Midjourney v6', vendor: 'Midjourney', category: 'closed', isActive: true },
  { id: 'midjourney-v5.2', name: 'Midjourney v5.2', vendor: 'Midjourney', category: 'closed', isActive: true },
  { id: 'midjourney-niji-6', name: 'Midjourney Niji 6', vendor: 'Midjourney', category: 'closed', isActive: true },

  // DALL-E (OpenAI)
  { id: 'dall-e-3', name: 'DALL-E 3', vendor: 'OpenAI', category: 'closed', isActive: true },
  { id: 'dall-e-2', name: 'DALL-E 2', vendor: 'OpenAI', category: 'closed', isActive: true },
  { id: 'gpt-4o-image', name: 'GPT-4o Image', vendor: 'OpenAI', category: 'closed', isActive: true },

  // Adobe Firefly
  { id: 'firefly-3', name: 'Adobe Firefly 3', vendor: 'Adobe', category: 'closed', isActive: true },
  { id: 'firefly-2', name: 'Adobe Firefly 2', vendor: 'Adobe', category: 'closed', isActive: true },

  // Google
  { id: 'imagen-3', name: 'Imagen 3', vendor: 'Google', category: 'closed', isActive: true },
  { id: 'imagen-2', name: 'Imagen 2', vendor: 'Google', category: 'closed', isActive: true },

  // Ideogram
  { id: 'ideogram-2', name: 'Ideogram 2.0', vendor: 'Ideogram', category: 'closed', isActive: true },
  { id: 'ideogram-1', name: 'Ideogram 1.0', vendor: 'Ideogram', category: 'closed', isActive: true },

  // Anthropic
  { id: 'claude-image', name: 'Claude Image', vendor: 'Anthropic', category: 'closed', isActive: true },

  // 其他闭源
  { id: 'leonardo-ai', name: 'Leonardo AI', vendor: 'Leonardo', category: 'closed', isActive: true },
  { id: 'playground-v3', name: 'Playground v3', vendor: 'Playground', category: 'closed', isActive: true },
  { id: 'runway-gen3', name: 'Runway Gen-3', vendor: 'Runway', category: 'closed', isActive: true },
  { id: 'kling-ai', name: 'Kling AI', vendor: 'Kuaishou', category: 'closed', isActive: true },
  { id: 'jimeng', name: '即梦 AI', vendor: 'ByteDance', category: 'closed', isActive: true },
  { id: 'doubao', name: '豆包', vendor: 'ByteDance', category: 'closed', isActive: true },
  { id: 'tongyi-wanxiang', name: '通义万相', vendor: 'Alibaba', category: 'closed', isActive: true },
  { id: 'wenxin-yige', name: '文心一格', vendor: 'Baidu', category: 'closed', isActive: true },
  { id: 'zhipu-cogview', name: '智谱 CogView', vendor: 'Zhipu AI', category: 'closed', isActive: true },

  // === 开源模型 ===
  // Stable Diffusion
  { id: 'sd-3.5-large', name: 'Stable Diffusion 3.5 Large', vendor: 'Stability AI', category: 'open', isActive: true },
  { id: 'sd-3.5-medium', name: 'Stable Diffusion 3.5 Medium', vendor: 'Stability AI', category: 'open', isActive: true },
  { id: 'sd-3', name: 'Stable Diffusion 3', vendor: 'Stability AI', category: 'open', isActive: true },
  { id: 'sdxl-1.0', name: 'SDXL 1.0', vendor: 'Stability AI', category: 'open', isActive: true },
  { id: 'sdxl-turbo', name: 'SDXL Turbo', vendor: 'Stability AI', category: 'open', isActive: true },
  { id: 'sd-1.5', name: 'Stable Diffusion 1.5', vendor: 'Stability AI', category: 'open', isActive: true },

  // FLUX
  { id: 'flux-1.1-pro', name: 'FLUX 1.1 Pro', vendor: 'Black Forest Labs', category: 'open', isActive: true },
  { id: 'flux-1-dev', name: 'FLUX.1 Dev', vendor: 'Black Forest Labs', category: 'open', isActive: true },
  { id: 'flux-1-schnell', name: 'FLUX.1 Schnell', vendor: 'Black Forest Labs', category: 'open', isActive: true },

  // 其他开源模型
  { id: 'pixart-sigma', name: 'PixArt-Sigma', vendor: 'PixArt', category: 'open', isActive: true },
  { id: 'pixart-alpha', name: 'PixArt-Alpha', vendor: 'PixArt', category: 'open', isActive: true },
  { id: 'playground-v2.5', name: 'Playground v2.5', vendor: 'Playground', category: 'open', isActive: true },
  { id: 'kandinsky-3', name: 'Kandinsky 3', vendor: 'Sber AI', category: 'open', isActive: true },
  { id: 'kolors', name: 'Kolors', vendor: 'Kuaishou', category: 'open', isActive: true },
  { id: 'hunyuan-dit', name: 'HunyuanDiT', vendor: 'Tencent', category: 'open', isActive: true },
  { id: 'cogview-3', name: 'CogView-3', vendor: 'Zhipu AI', category: 'open', isActive: true },
  { id: 'if-xl', name: 'IF-XL (DeepFloyd)', vendor: 'DeepFloyd', category: 'open', isActive: true },
  { id: 'wuerstchen', name: 'Würstchen', vendor: 'Stability AI', category: 'open', isActive: true },

  // 特化模型
  { id: 'animagine-xl', name: 'Animagine XL', vendor: 'Community', category: 'open', isActive: true },
  { id: 'pony-diffusion', name: 'Pony Diffusion', vendor: 'Community', category: 'open', isActive: true },
  { id: 'realvisxl', name: 'RealVisXL', vendor: 'Community', category: 'open', isActive: true },
  { id: 'dreamshaper-xl', name: 'DreamShaper XL', vendor: 'Community', category: 'open', isActive: true },
  { id: 'juggernaut-xl', name: 'Juggernaut XL', vendor: 'Community', category: 'open', isActive: true },
]

// 获取激活的模型列表
export function getActiveModels(): AIModel[] {
  return AI_MODELS.filter(m => m.isActive)
}

// 按厂商分组
export function getModelsByVendor(): Record<string, AIModel[]> {
  const active = getActiveModels()
  return active.reduce((acc, model) => {
    if (!acc[model.vendor]) {
      acc[model.vendor] = []
    }
    acc[model.vendor].push(model)
    return acc
  }, {} as Record<string, AIModel[]>)
}

// 按类别分组
export function getModelsByCategory(): { closed: AIModel[]; open: AIModel[] } {
  const active = getActiveModels()
  return {
    closed: active.filter(m => m.category === 'closed'),
    open: active.filter(m => m.category === 'open'),
  }
}
