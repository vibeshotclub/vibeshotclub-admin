#!/usr/bin/env python3
"""
Twitter Prompt Crawler - Backfill Mode
补抓指定日期范围内遗漏的推文（一次性运行）

用法:
  python backfill.py                    # 默认补抓最近 7 天
  python backfill.py --days 10          # 补抓最近 10 天
  python backfill.py --max-pages 10     # 每个用户最多翻 10 页
"""

import argparse
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from config import Config
from crawler import TwitterCrawler, Tweet
from ai import create_analyzer
from api import BotApiClient

logging.basicConfig(
    level=logging.DEBUG if Config.DEBUG else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def fetch_tweets_in_date_range(
    crawler: TwitterCrawler,
    username: str,
    since_date: datetime,
    max_pages: int = 10
) -> List[Tweet]:
    """获取用户在指定日期之后的所有带图推文（忽略 since_id，按日期过滤）"""
    all_tweets = []
    cursor = None

    for page in range(max_pages):
        logger.debug(f"  Fetching page {page + 1}...")

        try:
            results, next_cursor = crawler.fetch_timeline_page(username, cursor)
        except Exception as e:
            logger.error(f"  Failed to fetch page {page + 1}: {e}")
            break

        if not results:
            break

        reached_old = False
        for item in results:
            tweet = crawler._parse_tweet(item, username)
            if not tweet:
                continue

            # 如果推文时间早于目标日期，说明已经翻到更早的内容了
            tweet_time = tweet.created_at
            if tweet_time.tzinfo is None:
                tweet_time = tweet_time.replace(tzinfo=timezone.utc)
            if tweet_time < since_date:
                reached_old = True
                break

            if tweet.image_urls:
                all_tweets.append(tweet)

        if reached_old:
            logger.debug(f"  Reached tweets older than {since_date.date()} at page {page + 1}")
            break

        cursor = next_cursor
        if not cursor:
            break

    return all_tweets


def main():
    parser = argparse.ArgumentParser(description='Backfill missed tweets')
    parser.add_argument('--days', type=int, default=7, help='补抓最近 N 天的推文 (default: 7)')
    parser.add_argument('--max-pages', type=int, default=10, help='每个用户最多翻页数 (default: 10)')
    args = parser.parse_args()

    since_date = datetime.now(timezone.utc) - timedelta(days=args.days)

    logger.info("=" * 50)
    logger.info("Twitter Prompt Crawler - BACKFILL MODE")
    logger.info(f"Backfilling tweets since: {since_date.date()}")
    logger.info(f"Max pages per user: {args.max_pages}")
    logger.info(f"AI Provider: {Config.AI_PROVIDER}")
    logger.info("=" * 50)

    crawler = TwitterCrawler()
    analyzer = create_analyzer()
    api = BotApiClient()

    stats = {
        'creators_processed': 0,
        'tweets_found': 0,
        'tweets_analyzed': 0,
        'tweets_relevant': 0,
        'prompts_created': 0,
        'duplicates_skipped': 0,
        'images_failed': 0,
        'errors': 0
    }

    try:
        creators = api.get_active_creators()
        logger.info(f"Found {len(creators)} active creators")

        for creator in creators:
            logger.info(f"Processing @{creator.username}")
            stats['creators_processed'] += 1

            try:
                # 按日期范围抓取，不依赖 since_id
                tweets = fetch_tweets_in_date_range(
                    crawler,
                    username=creator.username,
                    since_date=since_date,
                    max_pages=args.max_pages
                )
                stats['tweets_found'] += len(tweets)
                logger.info(f"  Found {len(tweets)} tweets with images since {since_date.date()}")

                for tweet in tweets:
                    stats['tweets_analyzed'] += 1

                    analysis = analyzer.analyze_tweet(tweet)

                    if analysis.is_relevant and analysis.confidence >= Config.RELEVANCE_THRESHOLD:
                        if not analysis.extracted_prompt and not any(
                            kw in tweet.text.lower()
                            for kw in ['--', 'prompt', 'negative', 'artstation', 'detailed']
                        ):
                            logger.info(f"  Skipped ambiguous tweet: {tweet.id}")
                            continue

                        stats['tweets_relevant'] += 1

                        try:
                            result = api.create_prompt(
                                title=analysis.suggested_title or f"@{creator.username} 的提示词",
                                prompt_text=analysis.extracted_prompt or tweet.text,
                                image_urls=tweet.image_urls,
                                author_name=creator.username,
                                negative_prompt=analysis.extracted_negative_prompt,
                                model=analysis.suggested_model,
                                description=f"来源: {tweet.url}"
                            )

                            if result.success:
                                stats['prompts_created'] += 1
                                logger.info(f"  Created prompt: {result.prompt_id}")
                            elif result.skipped:
                                stats['duplicates_skipped'] += 1
                                logger.debug(f"  Skipped duplicate: {tweet.id}")
                            else:
                                stats['images_failed'] += 1
                                logger.warning(f"  Failed to create prompt: {result.error}")

                        except Exception as e:
                            logger.error(f"  Failed to create prompt: {e}")
                            stats['errors'] += 1
                    else:
                        logger.debug(f"  Skipped tweet {tweet.id}: {analysis.reason}")

            except Exception as e:
                logger.error(f"Error processing @{creator.username}: {e}")
                stats['errors'] += 1

    finally:
        crawler.close()
        api.close()

    logger.info("=" * 50)
    logger.info("Backfill completed!")
    logger.info(f"  Creators processed: {stats['creators_processed']}")
    logger.info(f"  Tweets found: {stats['tweets_found']}")
    logger.info(f"  Tweets analyzed: {stats['tweets_analyzed']}")
    logger.info(f"  Relevant tweets: {stats['tweets_relevant']}")
    logger.info(f"  Prompts created: {stats['prompts_created']}")
    logger.info(f"  Duplicates skipped: {stats['duplicates_skipped']}")
    logger.info(f"  Images failed: {stats['images_failed']}")
    logger.info(f"  Errors: {stats['errors']}")


if __name__ == '__main__':
    main()