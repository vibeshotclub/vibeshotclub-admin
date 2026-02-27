from typing import Optional
from dataclasses import dataclass
import json

import sys
sys.path.append('..')
from config import Config
from crawler import Tweet


@dataclass
class PromptAnalysis:
    is_relevant: bool
    confidence: float
    reason: str
    extracted_prompt: Optional[str] = None
    extracted_negative_prompt: Optional[str] = None
    suggested_title: Optional[str] = None
    suggested_model: Optional[str] = None


# 通用的系统提示词
SYSTEM_PROMPT = """你是一个专业的 AI 图像生成提示词分析专家。你的任务是严格判断 Twitter 推文是否包含用于 AI 图像生成的提示词 (prompt)。

判断标准 (必须全部满足):
1. 推文必须明确包含用于 AI 图像生成工具 (如 Midjourney, DALL-E, Stable Diffusion, Flux, ComfyUI, NovelAI 等) 的具体提示词。
2. 提示词通常是英文，包含具体的描述性词汇、艺术风格、光效描述或技术参数。
3. 必须包含 AI 专有的特征，例如：
   - 模型参数: --ar, --v, --style, --s, --stylize, --niji 等。
   - 负向提示词标签: Negative prompt, Undesired content 等。
   - 提示词权重符号: (word:1.2), [word], {word} 等。
   - 明确的 AI 模型引用: "Created with Flux", "Midjourney prompt:", "Stable Diffusion tag" 等。
4. 排除项 (即使包含以下内容也不视为相关):
   - 纯粹的推文描述 (如 "Today's sunset is beautiful")。
   - 仅包含标签而无提示词本体 (如 "Check out my #AIArt #Midjourney")。
   - 链接到外部提示词网站但推文本身无提示词内容。

请分析以下推文并返回 JSON 格式结果。"""


def get_user_prompt(tweet: Tweet) -> str:
    return f"""请分析这条推文:

推文内容:
{tweet.text}

推文包含 {len(tweet.image_urls)} 张图片。

请返回以下 JSON 格式:
{{
  "is_relevant": true/false,
  "confidence": 0.0-1.0,
  "reason": "判断理由",
  "extracted_prompt": "提取的正向提示词 (如果相关)",
  "extracted_negative_prompt": "提取的负向提示词 (如果有)",
  "suggested_title": "建议的标题 (中文，简短)",
  "suggested_model": "推测使用的模型 (如 midjourney-v6, flux-1.1-pro 等)"
}}

只返回 JSON，不要其他内容。"""


def parse_response(result_text: str) -> PromptAnalysis:
    """解析 AI 响应"""
    result_text = result_text.strip()
    if result_text.startswith('```'):
        result_text = result_text.split('```')[1]
        if result_text.startswith('json'):
            result_text = result_text[4:]

    result = json.loads(result_text)

    return PromptAnalysis(
        is_relevant=result.get('is_relevant', False),
        confidence=result.get('confidence', 0.0),
        reason=result.get('reason', ''),
        extracted_prompt=result.get('extracted_prompt'),
        extracted_negative_prompt=result.get('extracted_negative_prompt'),
        suggested_title=result.get('suggested_title'),
        suggested_model=result.get('suggested_model')
    )


class ClaudeAnalyzer:
    """Claude API 分析器"""

    def __init__(self):
        from anthropic import Anthropic
        self.client = Anthropic(api_key=Config.CLAUDE_API_KEY)

    def analyze_tweet(self, tweet: Tweet) -> PromptAnalysis:
        try:
            response = self.client.messages.create(
                model=Config.CLAUDE_MODEL,
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": get_user_prompt(tweet)}
                ],
                system=SYSTEM_PROMPT
            )
            return parse_response(response.content[0].text)
        except Exception as e:
            if Config.DEBUG:
                print(f"Claude analysis error: {e}")
            return PromptAnalysis(
                is_relevant=False,
                confidence=0.0,
                reason=f"分析失败: {str(e)}"
            )


class OpenAICompatibleAnalyzer:
    """OpenAI 兼容 API 分析器 (支持 OpenAI, DeepSeek, Qwen)"""

    def __init__(self, api_key: str, base_url: Optional[str], model: str):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    def analyze_tweet(self, tweet: Tweet) -> PromptAnalysis:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": get_user_prompt(tweet)}
                ]
            )
            return parse_response(response.choices[0].message.content)
        except Exception as e:
            if Config.DEBUG:
                print(f"OpenAI compatible analysis error: {e}")
            return PromptAnalysis(
                is_relevant=False,
                confidence=0.0,
                reason=f"分析失败: {str(e)}"
            )


def create_analyzer():
    """根据配置创建对应的分析器"""
    provider = Config.AI_PROVIDER

    if provider == 'claude':
        return ClaudeAnalyzer()
    elif provider == 'deepseek':
        return OpenAICompatibleAnalyzer(
            api_key=Config.DEEPSEEK_API_KEY,
            base_url=Config.DEEPSEEK_BASE_URL,
            model=Config.DEEPSEEK_MODEL
        )
    elif provider == 'openai':
        return OpenAICompatibleAnalyzer(
            api_key=Config.OPENAI_API_KEY,
            base_url=None,
            model=Config.OPENAI_MODEL
        )
    elif provider == 'qwen':
        return OpenAICompatibleAnalyzer(
            api_key=Config.QWEN_API_KEY,
            base_url=Config.QWEN_BASE_URL,
            model=Config.QWEN_MODEL
        )
    else:
        raise ValueError(f"Unknown AI provider: {provider}")
