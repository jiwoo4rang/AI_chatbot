import json
import os

import requests

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://121.189.21.229/api").rstrip("/")
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "ai-")
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "4000"))
LLM_CHAT_URL = f"{LLM_BASE_URL}/chat/completions"
LLM_MODELS_URL = f"{LLM_BASE_URL}/models"


def auth_headers(include_content_type=False):
    if not LLM_API_KEY:
        raise RuntimeError("LLM_API_KEY 환경 변수가 설정되어 있지 않습니다.")
    headers = {"Authorization": f"Bearer {LLM_API_KEY}"}
    if include_content_type:
        headers["Content-Type"] = "application/json"
    return headers


def clean_reply(text):
    reply = str(text or "").strip()
    for token in ["<|im_end|>", "<|im_start|>", "<|endoftext|>", "<end_of_turn>", "<start_of_turn>"]:
        reply = reply.replace(token, "").strip()
    return reply


def build_messages(user_message, history=None):
    messages = []
    for item in (history or [])[-6:]:
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    if not messages or messages[-1].get("content") != user_message:
        messages.append({"role": "user", "content": user_message})

    return messages


def call_llm(messages, model=None, temperature=0.3, max_tokens=None):
    payload = json.dumps(
        {
            "model": model or LLM_MODEL,
            "messages": messages,
            "max_tokens": max_tokens or LLM_MAX_TOKENS,
            "temperature": temperature,
            "stream": False,
        },
        ensure_ascii=False,
    ).encode("utf-8")

    resp = requests.post(
        LLM_CHAT_URL,
        headers=auth_headers(include_content_type=True),
        data=payload,
        timeout=120,
    )
    resp.raise_for_status()
    result = resp.json()
    return clean_reply(result["choices"][0]["message"]["content"])


def list_models():
    resp = requests.get(LLM_MODELS_URL, headers=auth_headers(), timeout=5)
    resp.raise_for_status()
    data = resp.json()
    return [
        {"key": m["id"], "display_name": m["id"], "type": "llm"}
        for m in data.get("data", [])
        if m.get("id")
    ]
