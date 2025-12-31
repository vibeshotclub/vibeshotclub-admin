import httpx
from typing import List, Optional
from dataclasses import dataclass

import sys
sys.path.append('..')
from config import Config


@dataclass
class Creator:
    id: str
    username: str
    display_name: Optional[str]
    last_tweet_id: Optional[str]


class BotApiClient:
    def __init__(self):
        self.base_url = Config.BOT_API_URL
        self.client = httpx.Client(
            timeout=60,  # 上传可能较慢
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

    def create_prompt(
        self,
        title: str,
        prompt_text: str,
        image_urls: List[str],
        author_name: str,
        negative_prompt: Optional[str] = None,
        model: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict:
        """创建提示词"""
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
        response.raise_for_status()
        return response.json()

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
