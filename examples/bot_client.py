#!/usr/bin/env python3
"""
Vibeshot Bot API Client Example
调用 /api/bot/upload 上传图片和 /api/bot/prompts 创建提示词的示例
"""

import requests
from typing import Optional
from pathlib import Path


class VibeshotBotClient:
    def __init__(self, base_url: str, api_key: str):
        """
        初始化客户端

        Args:
            base_url: API 基础地址，如 http://localhost:3000
            api_key: Bot API Key
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key

    def upload_image(self, file_path: str) -> dict:
        """
        上传图片

        Args:
            file_path: 图片文件路径

        Returns:
            {
                "success": true,
                "image_url": "https://...",
                "thumbnail_url": "https://..."
            }
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f'File not found: {file_path}')

        with open(path, 'rb') as f:
            files = {'file': (path.name, f, 'image/jpeg')}
            response = requests.post(
                f'{self.base_url}/api/bot/upload',
                files=files,
                headers={'x-api-key': self.api_key},
            )

        return response.json()

    def upload_images(self, file_paths: list[str]) -> list[dict]:
        """
        批量上传图片

        Args:
            file_paths: 图片文件路径列表

        Returns:
            上传结果列表，每个元素包含 image_url 和 thumbnail_url
        """
        results = []
        for path in file_paths:
            result = self.upload_image(path)
            if result.get('success'):
                results.append({
                    'image_url': result['image_url'],
                    'thumbnail_url': result['thumbnail_url'],
                })
            else:
                print(f'Failed to upload {path}: {result.get("error")}')
        return results

    def create_prompt(
        self,
        title: str,
        prompt_text: str,
        image_urls: list[str],
        description: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        author_name: Optional[str] = None,
        source: str = 'wechat',
        model: Optional[str] = None,
        is_featured: bool = False,
        is_published: bool = True,
        tag_ids: Optional[list[str]] = None,
    ) -> dict:
        """
        创建提示词

        Args:
            title: 标题（必填）
            prompt_text: 提示词内容（必填）
            image_urls: 图片 URL 列表，第一张作为封面（必填，至少一张）
            description: 描述
            negative_prompt: 负面提示词
            author_name: 作者名称
            source: 来源 (wechat/xiaohongshu/douyin/other)
            model: 使用的模型
            is_featured: 是否精选
            is_published: 是否发布
            tag_ids: 标签 ID 列表

        Returns:
            API 响应 dict
        """
        payload = {
            'title': title,
            'prompt_text': prompt_text,
            'image_urls': image_urls,
        }

        # 添加可选字段
        if description:
            payload['description'] = description
        if negative_prompt:
            payload['negative_prompt'] = negative_prompt
        if author_name:
            payload['author_name'] = author_name
        if source:
            payload['source'] = source
        if model:
            payload['model'] = model
        if is_featured:
            payload['is_featured'] = is_featured
        if not is_published:
            payload['is_published'] = is_published
        if tag_ids:
            payload['tag_ids'] = tag_ids

        response = requests.post(
            f'{self.base_url}/api/bot/prompts',
            json=payload,
            headers={
                'Content-Type': 'application/json',
                'x-api-key': self.api_key,
            },
        )

        return response.json()


# ============ 使用示例 ============
if __name__ == '__main__':
    # 配置
    BASE_URL = 'http://localhost:3000'  # 或你的部署地址
    API_KEY = 'your-bot-api-key'  # 替换为实际的 API Key

    # 创建客户端
    client = VibeshotBotClient(BASE_URL, API_KEY)

    # -------- 方式 1: 先上传图片，再创建提示词 --------
    # 上传本地图片
    uploaded = client.upload_images([
        '/path/to/image1.jpg',
        '/path/to/image2.jpg',
    ])
    print('Uploaded images:', uploaded)

    # 使用上传后的 URL 创建提示词
    if uploaded:
        result = client.create_prompt(
            title='赛博朋克女孩',
            prompt_text='cyberpunk girl, neon lights, futuristic city, rain, highly detailed, 8k',
            negative_prompt='low quality, blurry, deformed',
            image_urls=[img['image_url'] for img in uploaded],
            author_name='Bot',
            source='wechat',
            model='Midjourney v6',
        )
        print('Created prompt:', result)

    # -------- 方式 2: 直接传入网络图片 URL --------
    # API 会自动下载并处理
    result = client.create_prompt(
        title='赛博朋克女孩',
        prompt_text='cyberpunk girl, neon lights, futuristic city, rain, highly detailed, 8k',
        image_urls=[
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
        ],
        author_name='Bot',
    )
    print('Response:', result)
