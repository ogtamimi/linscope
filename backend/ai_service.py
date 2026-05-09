"""
AI Service for linscope Phase 4
Provides unified interface for local Ollama and cloud Groq APIs.
"""

import json
import asyncio
import httpx
from typing import AsyncGenerator, List, Dict, Any, Optional

# Configuration
OLLAMA_BASE_URL = "http://localhost:11434"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_API_KEY = "YOUR_GROQ_API_KEY"  # Replace with your key
DEFAULT_PROVIDER = "ollama"  # or "groq"
OLLAMA_LLM_MODEL = "llama3.2"
OLLAMA_EMBED_MODEL = "nomic-embed-text"
GROQ_MODEL = "llama-3.3-70b-versatile"  # Groq's recommended model

class AIService:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=60.0)
        self.system_context = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        return """You are an AI security analyst for Linscope, a Linux system observability platform.
Your role is to help users understand system activity, detect anomalies, and investigate potential security incidents.
Be concise, technical, and focus on actionable insights. When analyzing events, consider:
- Process relationships (parent-child)
- Network connections and suspicious ports
- File system changes and persistence mechanisms
- Privilege escalation attempts"""

    async def generate(
        self,
        prompt: str,
        context: Optional[List[Dict]] = None,
        provider: str = DEFAULT_PROVIDER,
        stream: bool = True,
        model: Optional[str] = None,
        ollama_base_url: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Generate AI response from specified provider."""
        messages = [{"role": "system", "content": self.system_context}]
        if context:
            messages.extend(context)
        messages.append({"role": "user", "content": prompt})

        if provider == "ollama":
            async for chunk in self._ollama_chat(messages, stream, model, ollama_base_url):
                if stream:
                    yield chunk
                else:
                    yield chunk
        elif provider == "groq":
            async for chunk in self._groq_chat(messages, stream, model):
                yield chunk
        else:
            raise ValueError(f"Unknown provider: {provider}")

    async def _ollama_chat(self, messages: List[Dict], stream: bool, model: Optional[str] = None, ollama_base_url: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Call Ollama API for chat completion."""
        base_url = ollama_base_url or OLLAMA_BASE_URL
        model = model or OLLAMA_LLM_MODEL
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "options": {"temperature": 0.7, "num_predict": 1024}
        }
        if stream:
            async with self.client.stream("POST", f"{base_url}/api/chat", json=payload) as response:
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            data = json.loads(line)
                            if "message" in data and "content" in data["message"]:
                                yield data["message"]["content"]
                        except json.JSONDecodeError:
                            continue
        else:
            response = await self.client.post(f"{base_url}/api/chat", json=payload)
            data = response.json()
            yield data.get("message", {}).get("content", "")

    async def _groq_chat(self, messages: List[Dict], stream: bool, model: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Call Groq API for chat completion."""
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
        model = model or GROQ_MODEL
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "temperature": 0.7,
            "max_tokens": 1024
        }
        if stream:
            async with self.client.stream("POST", f"{GROQ_BASE_URL}/chat/completions", headers=headers, json=payload) as response:
                async for line in response.aiter_lines():
                    if line.strip() and not line.startswith(":"):
                        try:
                            data = json.loads(line.replace("data: ", ""))
                            if "choices" in data and data["choices"]:
                                delta = data["choices"][0].get("delta", {})
                                if "content" in delta:
                                    yield delta["content"]
                        except (json.JSONDecodeError, KeyError):
                            continue
        else:
            response = await self.client.post(f"{GROQ_BASE_URL}/chat/completions", headers=headers, json=payload)
            data = response.json()
            yield data.get("choices", [{}])[0].get("message", {}).get("content", "")

    async def embed(self, text: str) -> List[float]:
        """Generate embedding for given text using Ollama."""
        payload = {"model": OLLAMA_EMBED_MODEL, "prompt": text}
        response = await self.client.post(f"{OLLAMA_BASE_URL}/api/embeddings", json=payload)
        data = response.json()
        return data.get("embedding", [])

    async def analyze_incident(self, events: List[Dict], provider: str = None, model: str = None, ollama_base_url: str = None) -> str:
        """Generate incident analysis summary."""
        prompt = f"""Analyze the following security events and provide a concise incident summary:
{json.dumps(events, indent=2)}
Include: threat assessment, attack timeline, and recommended remediation."""
        full_response = ""
        async for chunk in self.generate(prompt, stream=False, provider=provider, model=model, ollama_base_url=ollama_base_url):
            full_response = chunk
        return full_response

    async def suggest_investigation(self, context: str) -> str:
        """Suggest investigation steps based on suspicious activity."""
        prompt = f"""Based on suspicious activity: {context}
Provide step-by-step investigation commands to run on the Linux system."""
        full_response = ""
        async for chunk in self.generate(prompt, stream=False):
            full_response = chunk
        return full_response

ai_service = AIService()
