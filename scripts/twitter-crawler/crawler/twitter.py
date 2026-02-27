import httpx
import logging
from typing import List, Optional
from dataclasses import dataclass
from datetime import datetime
import time

from tenacity import retry, stop_after_attempt, wait_exponential

import sys
sys.path.append('..')
from config import Config

logger = logging.getLogger(__name__)


@dataclass
class Tweet:
    id: str
    username: str
    text: str
    image_urls: List[str]
    created_at: datetime
    url: str


class TwitterCrawler:
    """使用 RapidAPI Twttr API (twitter241) 抓取推文"""

    def __init__(self):
        self.client = httpx.Client(
            timeout=Config.REQUEST_TIMEOUT,
            headers={
                'x-rapidapi-key': Config.RAPIDAPI_KEY,
                'x-rapidapi-host': 'twitter241.p.rapidapi.com'
            }
        )
        self.base_url = 'https://twitter241.p.rapidapi.com'
        # 缓存 username -> user_id 映射，减少 API 调用
        self._user_id_cache: dict[str, str] = {}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def _get_user_id(self, username: str) -> Optional[str]:
        """通过 username 获取 Twitter 数字 user ID"""
        # 先查缓存
        if username in self._user_id_cache:
            return self._user_id_cache[username]

        response = self.client.get(
            f"{self.base_url}/user-media",
            params={'username': username}
        )

        # 尝试用专门的用户信息接口
        # 注意: Get User By Username 的 curl 显示 URL 是 /user-media
        # 但也可能有独立端点，先试 /user-media 不行再回退
        if response.status_code != 200:
            # 回退: 尝试其他可能的端点
            response = self.client.get(
                f"{self.base_url}/user",
                params={'username': username}
            )

        response.raise_for_status()
        data = response.json()

        # 解析 user ID: data > user > result > rest_id
        try:
            rest_id = data.get('user', {}).get('result', {}).get('rest_id')
            if rest_id:
                self._user_id_cache[username] = rest_id
                logger.debug(f"  Resolved @{username} -> user_id: {rest_id}")
                return rest_id
        except Exception:
            pass

        logger.warning(f"  Could not resolve user_id for @{username}")
        return None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def fetch_user_tweets(
        self,
        username: str,
        since_id: Optional[str] = None,
        max_count: int = Config.MAX_TWEETS_PER_USER
    ) -> List[Tweet]:
        """抓取用户的推文（仅带图片的）"""

        user_id = self._get_user_id(username)
        if not user_id:
            return []

        response = self.client.get(
            f"{self.base_url}/user-tweets",
            params={
                'user': user_id,
                'count': max_count
            }
        )
        response.raise_for_status()
        data = response.json()

        tweets = []
        entries = self._extract_entries(data)

        for entry in entries:
            tweet = self._parse_tweet(entry, username)
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
        """获取单页 timeline，返回 (原始 entry 列表, next_cursor)"""

        user_id = self._get_user_id(username)
        if not user_id:
            return [], None

        params = {
            'user': user_id,
            'count': 20
        }
        if cursor:
            params['cursor'] = cursor

        response = self.client.get(
            f"{self.base_url}/user-tweets",
            params=params
        )
        response.raise_for_status()
        data = response.json()

        entries = self._extract_entries(data)
        next_cursor = self._extract_cursor(data)

        time.sleep(Config.REQUEST_DELAY)
        return entries, next_cursor

    def _extract_entries(self, data: dict) -> List[dict]:
        """从 GraphQL 响应中提取 tweet entries"""
        entries = []
        try:
            result = data.get('result', {})
            timeline = result.get('timeline', {})
            instructions = timeline.get('instructions', [])

            for instruction in instructions:
                inst_type = instruction.get('type', '')
                if inst_type == 'TimelineAddEntries':
                    for entry in instruction.get('entries', []):
                        entry_type = entry.get('type', '')
                        # 只取推文 entry，跳过 cursor entry
                        if entry_type == 'TimelinePinEntry' or 'tweet' in entry.get('entryId', '').lower():
                            entries.append(entry)
                        elif entry_type == 'TimelineTimelineItem':
                            entries.append(entry)
        except Exception as e:
            if Config.DEBUG:
                logger.debug(f"Error extracting entries: {e}")
        return entries

    def _extract_cursor(self, data: dict) -> Optional[str]:
        """从 GraphQL 响应中提取 bottom cursor 用于分页"""
        try:
            result = data.get('result', {})
            timeline = result.get('timeline', {})

            # 方法1: 从 cursor 字段直接获取
            cursors = timeline.get('cursor', {})
            bottom = cursors.get('bottom')
            if bottom:
                return bottom

            # 方法2: 从 instructions > entries 中找 cursor entry
            instructions = timeline.get('instructions', [])
            for instruction in instructions:
                if instruction.get('type') == 'TimelineAddEntries':
                    for entry in instruction.get('entries', []):
                        entry_id = entry.get('entryId', '')
                        if 'cursor-bottom' in entry_id:
                            content = entry.get('content', {})
                            return content.get('value') or content.get('cursorType', {}).get('value')
        except Exception as e:
            if Config.DEBUG:
                logger.debug(f"Error extracting cursor: {e}")
        return None

    def _parse_tweet(self, entry: dict, username: str) -> Optional[Tweet]:
        """解析单条推文（Twitter GraphQL 格式）"""
        try:
            # GraphQL entry 结构:
            # entry > content > itemContent > tweet_results > result > legacy
            # 或直接就是 tweet_results 结构
            tweet_result = self._get_tweet_result(entry)
            if not tweet_result:
                return None

            # 获取 legacy 数据（包含推文核心信息）
            legacy = tweet_result.get('legacy', {})
            if not legacy:
                return None

            tweet_id = legacy.get('id_str', '') or str(tweet_result.get('rest_id', ''))
            if not tweet_id:
                return None

            # 跳过转推
            retweeted = legacy.get('retweeted_status_result')
            if retweeted:
                return None

            # 获取文本
            text = legacy.get('full_text', '') or legacy.get('text', '')

            # 获取图片 URL
            image_urls = []
            entities = legacy.get('extended_entities', {}) or legacy.get('entities', {})
            media_list = entities.get('media', [])

            for media in media_list:
                if media.get('type') == 'photo':
                    media_url = media.get('media_url_https', '')
                    if media_url:
                        image_urls.append(f"{media_url}?format=jpg&name=large")

            # 获取时间
            created_at = datetime.now()
            creation_date = legacy.get('created_at')
            if creation_date:
                try:
                    # 格式: "Tue Jan 06 14:54:38 +0000 2026"
                    created_at = datetime.strptime(creation_date, '%a %b %d %H:%M:%S %z %Y')
                except Exception:
                    pass

            # 获取作者用户名
            core = tweet_result.get('core', {})
            user_results = core.get('user_results', {}).get('result', {})
            user_legacy = user_results.get('legacy', {})
            screen_name = user_legacy.get('screen_name', username)

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
                logger.debug(f"Error parsing tweet: {e}")
            return None

    def _get_tweet_result(self, entry: dict) -> Optional[dict]:
        """从各种可能的 entry 结构中提取 tweet_result"""
        try:
            # 路径1: entry > content > itemContent > tweet_results > result
            content = entry.get('content', {})
            item_content = content.get('itemContent', {})
            tweet_results = item_content.get('tweet_results', {})
            result = tweet_results.get('result', {})
            if result:
                # 如果是 TweetWithVisibilityResults，再取一层
                if result.get('__typename') == 'TweetWithVisibilityResults':
                    result = result.get('tweet', {})
                return result if result.get('legacy') else None

            # 路径2: entry 本身就是 tweet_results 结构
            tweet_results = entry.get('tweet_results', {})
            result = tweet_results.get('result', {})
            if result:
                return result if result.get('legacy') else None

            # 路径3: entry > item > itemContent > tweet_results > result
            item = entry.get('item', {})
            item_content = item.get('itemContent', {})
            tweet_results = item_content.get('tweet_results', {})
            result = tweet_results.get('result', {})
            if result:
                return result if result.get('legacy') else None

        except Exception:
            pass
        return None

    def close(self):
        self.client.close()