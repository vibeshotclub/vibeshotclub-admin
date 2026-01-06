#!/usr/bin/env python3
"""
历史推文抓取脚本
用法: python history.py <username> [--days 10] [--max-pages 10]
"""

import argparse
import logging
import json
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

from config import Config
from crawler import TwitterCrawler
from ai import create_analyzer
from api import BotApiClient

logging.basicConfig(
    level=logging.DEBUG if Config.DEBUG else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def fetch_tweets_from_api(crawler, username, start_page, max_pages):
    """从 API 抓取推文，返回原始数据列表"""
    all_raw_tweets = []
    cursor = None

    # 跳过前面的页
    if start_page > 1:
        logger.info(f"跳过前 {start_page - 1} 页...")
        for skip in range(start_page - 1):
            try:
                _, cursor = crawler.fetch_timeline_page(username, cursor)
                if not cursor:
                    logger.error("没有更多页可跳过")
                    return all_raw_tweets
            except Exception as e:
                logger.error(f"跳页失败: {e}")
                logger.error(traceback.format_exc())
                return all_raw_tweets

    for page in range(max_pages):
        actual_page = start_page + page
        logger.info(f"正在获取第 {actual_page} 页...")

        try:
            results, next_cursor = crawler.fetch_timeline_page(username, cursor)
        except Exception as e:
            logger.error(f"获取失败: {e}")
            logger.error(traceback.format_exc())
            break

        if not results:
            logger.info("没有更多推文")
            break

        all_raw_tweets.extend(results)
        logger.info(f"  获取到 {len(results)} 条推文，累计 {len(all_raw_tweets)} 条")

        cursor = next_cursor
        if not cursor:
            logger.info("没有更多页")
            break

    return all_raw_tweets


def process_tweets(raw_tweets, crawler, analyzer, api, username, cutoff_date, dry_run):
    """处理推文：解析、AI 分析、入库"""
    stats = {
        'tweets_found': 0,
        'tweets_with_images': 0,
        'tweets_relevant': 0,
        'prompts_created': 0,
        'errors': 0
    }

    for item in raw_tweets:
        tweet = crawler._parse_tweet(item, username)
        if not tweet:
            continue

        stats['tweets_found'] += 1

        # 检查时间
        tweet_time = tweet.created_at
        if tweet_time.tzinfo is None:
            tweet_time = tweet_time.replace(tzinfo=timezone.utc)
        if tweet_time < cutoff_date:
            continue

        # 只处理有图片的
        if not tweet.image_urls:
            continue

        stats['tweets_with_images'] += 1
        logger.info(f"  [{tweet.created_at.strftime('%m-%d %H:%M')}] {tweet.text[:50]}...")

        # AI 分析
        analysis = analyzer.analyze_tweet(tweet)
        if not (analysis.is_relevant and analysis.confidence >= Config.RELEVANCE_THRESHOLD):
            logger.debug(f"    跳过: {analysis.reason}")
            continue

        stats['tweets_relevant'] += 1
        logger.info(f"    -> 相关! 置信度: {analysis.confidence:.2f}")
        logger.info(f"    提取的 Prompt: {(analysis.extracted_prompt or '')[:100]}...")

        if dry_run:
            logger.info(f"    [DRY-RUN] 标题: {analysis.suggested_title}")
            continue

        # 入库
        try:
            result = api.create_prompt(
                title=analysis.suggested_title or f"@{username} 的提示词",
                prompt_text=analysis.extracted_prompt or tweet.text,
                image_urls=tweet.image_urls,
                author_name=f"@{username}",
                negative_prompt=analysis.extracted_negative_prompt,
                model=analysis.suggested_model,
                description=f"来源: {tweet.url}"
            )
            stats['prompts_created'] += 1
            logger.info(f"    已创建: {result.get('prompt', {}).get('id')}")
        except Exception as e:
            logger.error(f"    入库失败: {e}")
            logger.error(f"    详细错误:\n{traceback.format_exc()}")
            stats['errors'] += 1

    return stats


def main():
    parser = argparse.ArgumentParser(description='抓取 Twitter 用户历史推文')
    parser.add_argument('username', help='Twitter 用户名')
    parser.add_argument('--days', type=int, default=10, help='抓取最近几天的推文 (默认 10)')
    parser.add_argument('--start-page', type=int, default=1, help='从第几页开始 (默认 1)')
    parser.add_argument('--max-pages', type=int, default=10, help='最多翻页数 (默认 10)')
    parser.add_argument('--dry-run', action='store_true', help='只分析不入库')
    parser.add_argument('--save-raw', type=str, help='保存原始推文到 JSON 文件')
    parser.add_argument('--load-raw', type=str, help='从本地 JSON 文件加载推文（跳过 API 抓取）')
    parser.add_argument('--fetch-only', action='store_true', help='只抓取不分析（配合 --save-raw 使用）')
    args = parser.parse_args()

    username = args.username.lstrip('@')
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=args.days)

    logger.info(f"用户: @{username}")
    logger.info(f"截止时间: {cutoff_date}")

    crawler = TwitterCrawler()

    try:
        # 获取原始推文数据
        if args.load_raw:
            # 从本地文件加载
            logger.info(f"从本地加载: {args.load_raw}")
            with open(args.load_raw, 'r', encoding='utf-8') as f:
                raw_tweets = json.load(f)
            logger.info(f"加载了 {len(raw_tweets)} 条推文")
        else:
            # 从 API 抓取
            raw_tweets = fetch_tweets_from_api(
                crawler, username, args.start_page, args.max_pages
            )

        # 保存原始数据
        if args.save_raw:
            output_path = Path(args.save_raw)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(raw_tweets, f, ensure_ascii=False, indent=2)
            logger.info(f"已保存 {len(raw_tweets)} 条原始推文到: {args.save_raw}")

        # 如果只抓取不分析，到这里就结束
        if args.fetch_only:
            logger.info("仅抓取模式，跳过分析")
            return

        # 处理推文
        analyzer = create_analyzer()
        api = BotApiClient() if not args.dry_run else None

        try:
            stats = process_tweets(
                raw_tweets, crawler, analyzer, api,
                username, cutoff_date, args.dry_run
            )
        finally:
            if api:
                api.close()

        # 输出统计
        logger.info("=" * 50)
        logger.info("处理完成!")
        logger.info(f"  推文总数: {stats['tweets_found']}")
        logger.info(f"  带图片: {stats['tweets_with_images']}")
        logger.info(f"  相关推文: {stats['tweets_relevant']}")
        logger.info(f"  已入库: {stats['prompts_created']}")
        logger.info(f"  错误: {stats['errors']}")

    finally:
        crawler.close()


if __name__ == '__main__':
    main()
