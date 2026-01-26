import httpx
from typing import List, Optional
from dataclasses import dataclass

from tenacity import retry, stop_after_attempt, wait_exponential

import sys
sys.path.append('..')
from config import Config


@dataclass
class Creator:
    id: str
    username: str
    display_name: Optional[str]
    last_tweet_id: Optional[str]


@dataclass
class CreatePromptResult:
    success: bool
    skipped: bool = False
    reason: Optional[str] = None
    prompt_id: Optional[str] = None
    images_count: int = 0
    failed_urls: Optional[List[str]] = None
    error: Optional[str] = None


class BotApiClient:
    def __init__(self):
        # 去掉末尾斜杠，避免 URL 拼接问题
        self.base_url = Config.BOT_API_URL.rstrip('/')
        self.client = httpx.Client(
            timeout=60,  # 上传可能较慢
            follow_redirects=True,  # 跟随重定向
            headers={
                'x-api-key': Config.BOT_API_KEY,
                'Content-Type': 'application/json'
            }
        )

    def get_active_creators(self) -> List[Creator]:
        """获取活跃的 Twitter 创作者列表"""
        response = self.client.get(f"{self.base_url}/api/bot/creators")
        response.raise_for_status()
        data = response.json()

        return [
            Creator(
                id=c['id'],
                username=c['username'],
                display_name=c.get('display_name'),
                last_tweet_id=c.get('last_tweet_id')
            )
            for c in data.get('creators', [])
        ]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def create_prompt(
        self,
        title: str,
        prompt_text: str,
        image_urls: List[str],
        author_name: str,
        negative_prompt: Optional[str] = None,
        model: Optional[str] = None,
        description: Optional[str] = None,
    ) -> CreatePromptResult:
        """创建提示词，支持去重检测和图片失败记录"""
        payload = {
            'title': title,
            'prompt_text': prompt_text,
            'image_urls': image_urls,
            'author_name': author_name,
            'source': 'twitter',
            'is_published': True,
            'is_featured': False,
        }

        if negative_prompt:
            payload['negative_prompt'] = negative_prompt
        if model:
            payload['model'] = model
        if description:
            payload['description'] = description

        response = self.client.post(
            f"{self.base_url}/api/bot/prompts",
            json=payload
        )
        
        data = response.json()
        
        # 处理 200 响应 (可能是跳过重复)
        if response.status_code == 200:
            if data.get('skipped'):
                return CreatePromptResult(
                    success=False,
                    skipped=True,
                    reason=data.get('reason', 'duplicate'),
                )
            return CreatePromptResult(
                success=data.get('success', False),
                prompt_id=data.get('prompt', {}).get('id'),
                images_count=data.get('images_count', 0),
                failed_urls=data.get('failed_urls'),
            )
        
        # 处理 201 响应 (成功创建)
        if response.status_code == 201:
            return CreatePromptResult(
                success=True,
                prompt_id=data.get('prompt', {}).get('id'),
                images_count=data.get('images_count', 0),
                failed_urls=data.get('failed_urls'),
            )
        
        # 处理 400 响应 (图片全部失败等)
        if response.status_code == 400:
            return CreatePromptResult(
                success=False,
                error=data.get('error'),
                failed_urls=data.get('failed_urls'),
            )
        
        # 其他错误
        response.raise_for_status()
        return CreatePromptResult(success=False, error='Unknown error')

    def update_creator_status(
        self,
        creator_id: str,
        last_tweet_id: Optional[str] = None,
        increment_fetch: bool = False,
        increment_success: bool = False
    ):
        """更新创作者抓取状态"""
        payload = {
            'creator_id': creator_id,
            'increment_fetch': increment_fetch,
            'increment_success': increment_success,
        }
        if last_tweet_id:
            payload['last_tweet_id'] = last_tweet_id

        response = self.client.patch(
            f"{self.base_url}/api/bot/creators",
            json=payload
        )
        response.raise_for_status()

    def close(self):
        self.client.close()