import httpx
from typing import List, Optional
from dataclasses import dataclass
from datetime import datetime
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


class TwitterCrawler:
    """使用 RapidAPI Twitter API45 抓取推文"""

    def __init__(self):
        self.client = httpx.Client(
            timeout=Config.REQUEST_TIMEOUT,
            headers={
                'x-rapidapi-key': Config.RAPIDAPI_KEY,
                'x-rapidapi-host': 'twitter-api45.p.rapidapi.com'
            }
        )
        self.base_url = 'https://twitter-api45.p.rapidapi.com'

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def fetch_user_tweets(
        self,
        username: str,
        since_id: Optional[str] = None,
        max_count: int = Config.MAX_TWEETS_PER_USER
    ) -> List[Tweet]:
        """抓取用户的推文（仅带图片的）"""

        # 获取用户推文
        response = self.client.get(
            f"{self.base_url}/timeline.php",
            params={
                'screenname': username
            }
        )
        response.raise_for_status()
        data = response.json()

        tweets = []
        results = data.get('timeline', [])

        for item in results:
            tweet = self._parse_tweet(item, username)
            if tweet:
                # 增量抓取: 跳过已处理的推文
                if since_id and tweet.id <= since_id:
                    continue
                # 只保留有图片的推文
                if tweet.image_urls:
                    tweets.append(tweet)

        time.sleep(Config.REQUEST_DELAY)
        return tweets

    def fetch_timeline_page(
        self,
        username: str,
        cursor: Optional[str] = None
    ) -> tuple[List[dict], Optional[str]]:
        """获取单页 timeline，返回 (原始数据列表, next_cursor)"""
        params = {'screenname': username}
        if cursor:
            params['cursor'] = cursor

        response = self.client.get(
            f"{self.base_url}/timeline.php",
            params=params
        )
        response.raise_for_status()
        data = response.json()

        results = data.get('timeline', [])
        next_cursor = data.get('next_cursor')

        time.sleep(Config.REQUEST_DELAY)
        return results, next_cursor

    def _parse_tweet(self, item: dict, username: str) -> Optional[Tweet]:
        """解析单条推文"""
        try:
            tweet_id = item.get('tweet_id', '')
            if not tweet_id:
                return None

            # 跳过转推
            if item.get('retweeted'):
                return None

            # 获取文本
            text = item.get('text', '')

            # 获取图片 URL
            image_urls = []
            media = item.get('media', {})
            photos = media.get('photo', [])

            for photo in photos:
                media_url = photo.get('media_url_https', '')
                if media_url:
                    # 获取最大尺寸
                    image_urls.append(f"{media_url}?format=jpg&name=large")

            # 获取时间
            created_at = datetime.now()
            creation_date = item.get('created_at')
            if creation_date:
                try:
                    # 格式: "Tue Jan 06 14:54:38 +0000 2026"
                    created_at = datetime.strptime(creation_date, '%a %b %d %H:%M:%S %z %Y')
                except Exception:
                    pass

            # 获取作者用户名
            author = item.get('author', {})
            screen_name = author.get('screen_name', username)

            return Tweet(
                id=tweet_id,
                username=screen_name,
                text=text,
                image_urls=image_urls,
                created_at=created_at,
                url=f"https://twitter.com/{screen_name}/status/{tweet_id}"
            )
        except Exception as e:
            if Config.DEBUG:
                print(f"Error parsing tweet: {e}")
            return None

    def close(self):
        self.client.close()
