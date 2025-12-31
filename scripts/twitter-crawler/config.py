import os
from typing import List


class Config:
    # Bot API
    BOT_API_URL = os.getenv('BOT_API_URL', 'https://admin.vibeshotclub.com')
    BOT_API_KEY = os.getenv('BOT_API_KEY', '')

    # AI Provider: claude, deepseek, openai, qwen
    AI_PROVIDER = os.getenv('AI_PROVIDER', 'claude').lower()

    # Claude
    CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY', '')
    CLAUDE_MODEL = 'claude-sonnet-4-20250514'

    # DeepSeek
    DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '')
    DEEPSEEK_MODEL = 'deepseek-chat'
    DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

    # OpenAI
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
    OPENAI_MODEL = 'gpt-4o'

    # Qwen (阿里云)
    QWEN_API_KEY = os.getenv('QWEN_API_KEY', '')
    QWEN_MODEL = 'qwen-plus'
    QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

    # Nitter instances (fallback 列表)
    NITTER_INSTANCES: List[str] = [
        inst.strip()
        for inst in os.getenv(
            'NITTER_INSTANCES',
            'nitter.privacydev.net,nitter.poast.org'
        ).split(',')
        if inst.strip()
    ]

    # 爬虫配置
    MAX_TWEETS_PER_USER = 20  # 每个用户最多抓取的推文数
    REQUEST_TIMEOUT = 30
    REQUEST_DELAY = 2  # 请求间隔 (秒)

    # AI 判断阈值
    RELEVANCE_THRESHOLD = 0.7  # 相关性阈值

    # Debug
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
