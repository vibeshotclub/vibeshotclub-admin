import httpx
import json
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


def _find_rest_id(data, depth: int = 0) -> Optional[str]:
    """递归搜索 JSON 中的 rest_id 字段"""
    if depth > 8 or data is None:
        return None
    if isinstance(data, dict):
        if 'rest_id' in data:
            return str(data['rest_id'])
        if 'id_str' in data and data.get('__typename') == 'User':
            return str(data['id_str'])
        for key, val in data.items():
            if isinstance(val, (dict, list)):
                found = _find_rest_id(val, depth + 1)
                if found:
                    return found
    elif isinstance(data, list):
        for item in data:
            found = _find_rest_id(item, depth + 1)
            if found:
                return found
    return None


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
            f"{self.base_url}/user",
            params={'username': username}
        )
        response.raise_for_status()
        data = response.json()

        # 打印返回数据前 800 字符，帮助调试 JSON 结构
        raw = json.dumps(data, ensure_ascii=False)[:800]
        logger.info(f"  /user response for @{username}: {raw}")

        # 尝试多种可能的 JSON 路径提取 rest_id
        rest_id = None

        # 路径1: data > user > result > rest_id
        try:
            rest_id = data['user']['result']['rest_id']
        except (KeyError, TypeError):
            pass

        # 路径2: data > result > rest_id
        if not rest_id:
            try:
                rest_id = data['result']['rest_id']
            except (KeyError, TypeError):
                pass

        # 路径3: data > data > user > result > rest_id
        if not rest_id:
            try:
                rest_id = data['data']['user']['result']['rest_id']
            except (KeyError, TypeError):
                pass

        # 路径4: data > rest_id
        if not rest_id:
            rest_id = data.get('rest_id')

        # 路径5: data > id_str 或 data > id
        if not rest_id:
            rest_id = data.get('id_str') or data.get('id')

        # 路径6: 递归搜索整个 JSON
        if not rest_id:
            rest_id = _find_rest_id(data)

        if rest_id:
            rest_id = str(rest_id)
            self._user_id_cache[username] = rest_id
            logger.info(f"  Resolved @{username} -> user_id: {rest_id}")
            return rest_id

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
                if since_id and tweet.id <= since_id:
                    continue
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
            # 尝试路径: data > result > timeline > instructions
            result = data.get('result', {})
            timeline = result.get('timeline', {})
            instructions = timeline.get('instructions', [])

            for instruction in instructions:
                inst_type = instruction.get('type', '')
                if inst_type == 'TimelineAddEntries':
                    for entry in instruction.get('entries', []):
                        entry_id = entry.get('entryId', '').lower()
                        if 'tweet' in entry_id or 'pin' in entry_id:
                            entries.append(entry)

            # 备选路径: data > timeline > instructions
            if not entries:
                timeline2 = data.get('timeline', {})
                instructions2 = timeline2.get('instructions', [])
                for instruction in instructions2:
                    for entry in instruction.get('entries', []):
                        entry_id = entry.get('entryId', '').lower()
                        if 'tweet' in entry_id or 'pin' in entry_id:
                            entries.append(entry)

        except Exception as e:
            logger.debug(f"Error extracting entries: {e}")

        logger.debug(f"  Extracted {len(entries)} tweet entries")
        return entries

    def _extract_cursor(self, data: dict) -> Optional[str]:
        """从 GraphQL 响应中提取 bottom cursor 用于分页"""
        try:
            result = data.get('result', {})
            timeline = result.get('timeline', {})

            # 方法1: cursor 字段
            cursors = timeline.get('cursor', {})
            bottom = cursors.get('bottom')
            if bottom:
                return bottom

            # 方法2: 从 entries 中找 cursor-bottom
            instructions = timeline.get('instructions', [])
            for instruction in instructions:
                if instruction.get('type') == 'TimelineAddEntries':
                    for entry in instruction.get('entries', []):
                        entry_id = entry.get('entryId', '')
                        if 'cursor-bottom' in entry_id:
                            content = entry.get('content', {})
                            value = content.get('value')
                            if value:
                                return value
                            item_content = content.get('itemContent', {})
                            return item_content.get('value')

            # 方法3: data > timeline > cursor
            timeline2 = data.get('timeline', {})
            cursors2 = timeline2.get('cursor', {})
            return cursors2.get('bottom')

        except Exception as e:
            logger.debug(f"Error extracting cursor: {e}")
        return None

    def _parse_tweet(self, entry: dict, username: str) -> Optional[Tweet]:
        """解析单条推文（Twitter GraphQL 格式）"""
        try:
            tweet_result = self._get_tweet_result(entry)
            if not tweet_result:
                return None

            legacy = tweet_result.get('legacy', {})
            if not legacy:
                return None

            tweet_id = legacy.get('id_str', '') or str(tweet_result.get('rest_id', ''))
            if not tweet_id:
                return None

            # 跳过转推
            if legacy.get('retweeted_status_result'):
                return None

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
                if result.get('__typename') == 'TweetWithVisibilityResults':
                    result = result.get('tweet', {})
                return result if result.get('legacy') else None

            # 路径2: entry > tweet_results > result
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