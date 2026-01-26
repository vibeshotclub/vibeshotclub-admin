#!/usr/bin/env python3
"""
Twitter Prompt Crawler
从 Twitter 创作者获取 AI 图像提示词并入库
"""

import logging
from typing import List, Optional
from config import Config
from crawler import TwitterCrawler, Tweet
from ai import create_analyzer
from api import BotApiClient

# 配置日志
logging.basicConfig(
    level=logging.DEBUG if Config.DEBUG else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 每个用户最多翻页数（防止无限循环）
MAX_PAGES_PER_USER = 5


def fetch_all_new_tweets(
    crawler: TwitterCrawler,
    username: str,
    since_id: Optional[str] = None
) -> List[Tweet]:
    """获取用户所有新推文（支持分页），直到遇到 since_id 或达到上限"""
    all_tweets = []
    cursor = None

    for page in range(MAX_PAGES_PER_USER):
        logger.debug(f"  Fetching page {page + 1}...")

        try:
            results, next_cursor = crawler.fetch_timeline_page(username, cursor)
        except Exception as e:
            logger.error(f"  Failed to fetch page {page + 1}: {e}")
            break

        if not results:
            break

        reached_since_id = False
        for item in results:
            tweet = crawler._parse_tweet(item, username)
            if not tweet:
                continue

            # 增量检查：遇到已处理的推文就停止
            if since_id and tweet.id <= since_id:
                reached_since_id = True
                break

            # 只保留有图片的
            if tweet.image_urls:
                all_tweets.append(tweet)

        if reached_since_id:
            logger.debug(f"  Reached since_id at page {page + 1}")
            break

        cursor = next_cursor
        if not cursor:
            break

    return all_tweets


def main():
    logger.info("Starting Twitter Prompt Crawler")
    logger.info(f"Debug mode: {Config.DEBUG}")
    logger.info(f"AI Provider: {Config.AI_PROVIDER}")

    # 初始化组件
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
        # 获取活跃创作者列表
        creators = api.get_active_creators()
        logger.info(f"Found {len(creators)} active creators")

        for creator in creators:
            logger.info(f"Processing @{creator.username}")
            stats['creators_processed'] += 1

            try:
                # 抓取所有新推文（分页）
                tweets = fetch_all_new_tweets(
                    crawler,
                    username=creator.username,
                    since_id=creator.last_tweet_id
                )
                stats['tweets_found'] += len(tweets)
                logger.info(f"  Found {len(tweets)} new tweets with images")

                latest_tweet_id = None

                for tweet in tweets:
                    stats['tweets_analyzed'] += 1

                    # AI 分析
                    analysis = analyzer.analyze_tweet(tweet)

                    if analysis.is_relevant and analysis.confidence >= Config.RELEVANCE_THRESHOLD:
                        stats['tweets_relevant'] += 1
                        logger.info(f"  Relevant tweet found: {tweet.id}")

                        try:
                            # 调用 Bot API 入库
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
                                
                                # 更新成功计数
                                api.update_creator_status(
                                    creator_id=creator.id,
                                    increment_success=True
                                )
                            elif result.skipped:
                                stats['duplicates_skipped'] += 1
                                logger.info(f"  Skipped duplicate: {tweet.id}")
                            else:
                                # 图片处理失败等情况
                                stats['images_failed'] += 1
                                logger.warning(f"  Failed to create prompt: {result.error}")
                                if result.failed_urls:
                                    logger.warning(f"    Failed URLs: {result.failed_urls}")
                                    
                        except Exception as e:
                            logger.error(f"  Failed to create prompt: {e}")
                            stats['errors'] += 1
                    else:
                        logger.debug(f"  Skipped tweet {tweet.id}: {analysis.reason}")

                    # 记录最新推文 ID
                    if not latest_tweet_id or tweet.id > latest_tweet_id:
                        latest_tweet_id = tweet.id

                # 更新创作者状态
                api.update_creator_status(
                    creator_id=creator.id,
                    last_tweet_id=latest_tweet_id,
                    increment_fetch=True
                )

            except Exception as e:
                logger.error(f"Error processing @{creator.username}: {e}")
                stats['errors'] += 1

    finally:
        crawler.close()
        api.close()

    # 输出统计
    logger.info("=" * 50)
    logger.info("Crawl completed!")
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