import httpx
from bs4 import BeautifulSoup
from typing import List, Optional
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import unquote
import time

from tenacity import retry, stop_after_attempt, wait_exponential

import sys
sys.path.append('..')
from config import Config


@dataclass
class Tweet:
    id: str
    username: str
    text: str
    image_urls: List[str]
    created_at: datetime
    url: str


class NitterCrawler:
    def __init__(self):
        self.instances = Config.NITTER_INSTANCES.copy()
        self.current_instance_idx = 0
        self.client = httpx.Client(
            timeout=Config.REQUEST_TIMEOUT,
            follow_redirects=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        )

    def _get_current_instance(self) -> str:
        return self.instances[self.current_instance_idx % len(self.instances)]

    def _rotate_instance(self):
        self.current_instance_idx += 1
        if Config.DEBUG:
            print(f"Rotating to instance: {self._get_current_instance()}")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def fetch_user_tweets(
        self,
        username: str,
        since_id: Optional[str] = None,
        max_count: int = Config.MAX_TWEETS_PER_USER
    ) -> List[Tweet]:
        """抓取用户的推文"""
        instance = self._get_current_instance()
        url = f"https://{instance}/{username}/media"  # 只抓取带媒体的推文

        try:
            response = self.client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as e:
            self._rotate_instance()
            raise e

        soup = BeautifulSoup(response.text, 'lxml')
        tweets = []

        # 解析推文
        for item in soup.select('.timeline-item'):
            tweet = self._parse_tweet_item(item, username, instance)
            if tweet:
                # 增量抓取: 跳过已处理的推文
                if since_id and tweet.id <= since_id:
                    break
                # 只保留有图片的推文
                if tweet.image_urls:
                    tweets.append(tweet)
                    if len(tweets) >= max_count:
                        break

        time.sleep(Config.REQUEST_DELAY)
        return tweets

    def _parse_tweet_item(self, item, username: str, instance: str) -> Optional[Tweet]:
        """解析单条推文"""
        try:
            # 获取推文 ID
            link = item.select_one('.tweet-link')
            if not link:
                return None
            tweet_path = link.get('href', '')
            tweet_id = tweet_path.split('/')[-1].split('#')[0]

            # 获取文本内容
            content = item.select_one('.tweet-content')
            text = content.get_text(strip=True) if content else ''

            # 获取图片 URL
            image_urls = []
            for img in item.select('.attachment.image img'):
                src = img.get('src', '')
                if src:
                    # 将 Nitter 代理 URL 转换为原始 Twitter URL
                    if '/pic/' in src:
                        original_url = self._convert_nitter_image_url(src, instance)
                        if original_url:
                            image_urls.append(original_url)

            # 获取时间
            time_elem = item.select_one('.tweet-date a')
            created_at = datetime.now()  # 默认值
            if time_elem:
                title = time_elem.get('title', '')
                try:
                    created_at = datetime.strptime(title, '%b %d, %Y · %I:%M %p %Z')
                except Exception:
                    pass

            return Tweet(
                id=tweet_id,
                username=username,
                text=text,
                image_urls=image_urls,
                created_at=created_at,
                url=f"https://twitter.com/{username}/status/{tweet_id}"
            )
        except Exception as e:
            if Config.DEBUG:
                print(f"Error parsing tweet: {e}")
            return None

    def _convert_nitter_image_url(self, nitter_url: str, instance: str) -> Optional[str]:
        """将 Nitter 图片 URL 转换为 Twitter CDN URL"""
        # Nitter URL 格式: https://instance/pic/media%2FxxxxId.jpg
        # Twitter URL 格式: https://pbs.twimg.com/media/xxxxId?format=jpg&name=large
        try:
            if '/pic/' in nitter_url:
                encoded_path = nitter_url.split('/pic/')[-1]
                decoded = unquote(encoded_path)
                # 提取 media ID
                if 'media/' in decoded:
                    media_part = decoded.split('media/')[-1]
                    # 处理扩展名
                    if '.' in media_part:
                        name, ext = media_part.rsplit('.', 1)
                    else:
                        name, ext = media_part, 'jpg'
                    return f"https://pbs.twimg.com/media/{name}?format={ext}&name=large"
            return None
        except Exception:
            return None

    def close(self):
        self.client.close()
