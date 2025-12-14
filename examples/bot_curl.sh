#!/bin/bash
# Vibeshot Bot API - cURL 调用示例

BASE_URL="http://localhost:3000"
API_KEY="your-bot-api-key"

# ======== 1. 上传图片 ========
# 上传本地图片文件
curl -X POST "${BASE_URL}/api/bot/upload" \
  -H "x-api-key: ${API_KEY}" \
  -F "file=@/path/to/image.jpg"

# 响应示例:
# {
#   "success": true,
#   "image_url": "https://xxx.r2.cloudflarestorage.com/images/xxx.webp",
#   "thumbnail_url": "https://xxx.r2.cloudflarestorage.com/thumbnails/xxx.webp"
# }

# ======== 2. 创建提示词（使用上传后的 URL）========
curl -X POST "${BASE_URL}/api/bot/prompts" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "title": "赛博朋克女孩",
    "prompt_text": "cyberpunk girl, neon lights, futuristic city, rain, highly detailed, 8k",
    "negative_prompt": "low quality, blurry, deformed",
    "image_urls": [
      "https://xxx.r2.cloudflarestorage.com/images/xxx.webp"
    ],
    "author_name": "Bot",
    "source": "wechat",
    "model": "Midjourney v6",
    "is_published": true
  }'

# ======== 3. 或者直接传网络图片 URL（后端自动下载）========
curl -X POST "${BASE_URL}/api/bot/prompts" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "title": "赛博朋克女孩",
    "prompt_text": "cyberpunk girl, neon lights, futuristic city, rain, highly detailed, 8k",
    "image_urls": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "author_name": "Bot"
  }'
