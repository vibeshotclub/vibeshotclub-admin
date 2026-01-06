#!/usr/bin/env python3
"""
Twitter Prompt Crawler
从 Twitter 创作者获取 AI 图像提示词并入库
"""

import logging
from config import Config
from crawler import TwitterCrawler
from ai import create_analyzer
from api import BotApiClient

# 配置日志
logging.basicConfig(
    level=logging.DEBUG if Config.DEBUG else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


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
                # 抓取推文
                tweets = crawler.fetch_user_tweets(
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
                            stats['prompts_created'] += 1
                            logger.info(f"  Created prompt: {result.get('prompt', {}).get('id')}")

                            # 更新成功计数
                            api.update_creator_status(
                                creator_id=creator.id,
                                increment_success=True
                            )
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
    logger.info(f"  Errors: {stats['errors']}")


if __name__ == '__main__':
    main()
