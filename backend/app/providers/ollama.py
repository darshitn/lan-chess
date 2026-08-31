from __future__ import annotations

import asyncio
import json
import os
import time
from typing import AsyncIterator, Any

import httpx

from app.providers.base import (
    GenerateOptions,
    ModelNotFoundError,
    Provider,
    ProviderError,
    ProviderHealth,
    ProviderMessage,
    ProviderModel,
    ProviderResponse,
    ProviderTimeoutError,
    ProviderUnavailableError,
)


def _ollama_base_url(configured: str | None = None) -> str:
    # Priority: explicit arg > env OLLAMA_HOST / OLLAMA_URL > default
    # Handles system env OLLAMA_HOST=0.0.0.0 (listen address) -> translate to localhost for client
    env = os.getenv("OLLAMA_HOST") or os.getenv("OLLAMA_URL") or ""
    base = (configured or env or "http://127.0.0.1:11434").strip().rstrip("/")
    if base == "0.0.0.0" or base == "0.0.0.0:11434":
        base = "http://127.0.0.1:11434"
    elif base.startswith("0.0.0.0:"):
        base = base.replace("0.0.0.0", "127.0.0.1", 1)
        if not base.startswith("http"):
            base = "http://" + base
    elif base and not base.startswith("http"):
        # e.g., "0.0.0.0" or "localhost:11434" without scheme
        if base.startswith("127.0.0.1") or base.startswith("localhost") or base.startswith("0.0.0.0"):
            base = "http://" + base
    return base


class OllamaProvider(Provider):
    kind = "ollama"  # type: ignore[assignment]

    def __init__(self, base_url: str | None = None, timeout_s: float = 30.0, client: httpx.AsyncClient | None = None):
        self.base_url = _ollama_base_url(base_url)
        self.timeout_s = timeout_s
        self._client = client  # injectable for tests
        self._cancel_tokens: set[asyncio.Task] = set()

    def is_configured(self) -> bool:
        # Consider configured if URL is set (default counts). True even if server down — health() distinguishes.
        return bool(self.base_url)

    def supports_streaming(self) -> bool:
        return True

    def supports_cancellation(self) -> bool:
        return True

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        return httpx.AsyncClient(timeout=httpx.Timeout(self.timeout_s))

    async def health(self) -> ProviderHealth:
        start = time.monotonic()
        url = f"{self.base_url}/api/tags"
        client = self._get_client()
        close = self._client is None
        try:
            resp = await client.get(url, timeout=5.0)
            latency = int((time.monotonic() - start) * 1000)
            if resp.status_code == 200:
                return ProviderHealth(available=True, provider="ollama", latency_ms=latency, details={"url": self.base_url})
            return ProviderHealth(available=False, provider="ollama", latency_ms=latency, error=f"status {resp.status_code}", details={"url": self.base_url, "status": resp.status_code})
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout, OSError) as e:
            return ProviderHealth(available=False, provider="ollama", error=str(e), details={"url": self.base_url, "exception": type(e).__name__})
        except Exception as e:
            return ProviderHealth(available=False, provider="ollama", error=str(e), details={"url": self.base_url})
        finally:
            if close:
                await client.aclose()

    async def list_models(self) -> list[ProviderModel]:
        url = f"{self.base_url}/api/tags"
        client = self._get_client()
        close = self._client is None
        try:
            resp = await client.get(url, timeout=10.0)
            if resp.status_code != 200:
                raise ProviderUnavailableError(f"Ollama unavailable: HTTP {resp.status_code}", provider="ollama")
            data = resp.json()
            models = []
            for m in data.get("models", []):
                name = m.get("name") or m.get("model") or ""
                if not name:
                    continue
                models.append(
                    ProviderModel(
                        id=name,
                        name=name,
                        provider="ollama",
                        size=m.get("size"),
                        modified_at=m.get("modified_at"),
                        details=m,
                    )
                )
            return models
        except httpx.TimeoutException as e:
            raise ProviderTimeoutError(f"Ollama list_models timeout: {e}", provider="ollama", cause=e) from e
        except httpx.ConnectError as e:
            raise ProviderUnavailableError(f"Ollama connection failed: {e}", provider="ollama", cause=e) from e
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"Ollama list_models error: {e}", provider="ollama", cause=e) from e
        finally:
            if close:
                await client.aclose()

    async def _ensure_model_available(self, model: str | None) -> str | None:
        if not model:
            return None
        # Check availability via list_models, but don't fail hard if list fails — let generate surface error
        try:
            models = await self.list_models()
            ids = {m.id for m in models}
            # Ollama tags may include :latest suffix variations; allow exact or base match
            if model in ids:
                return model
            # try base name without tag
            base = model.split(":")[0]
            for mid in ids:
                if mid.split(":")[0] == base:
                    return mid
            raise ModelNotFoundError(model, provider="ollama")
        except ModelNotFoundError:
            raise
        except ProviderError:
            # If health unavailable, propagate differently
            raise
        except Exception as e:
            raise ProviderError(str(e), provider="ollama", cause=e) from e

    def _messages_to_prompt(self, messages: list[ProviderMessage]) -> str:
        # Ollama /api/generate uses prompt; /api/chat uses messages. We support chat endpoint.
        # Prefer chat format if messages include system.
        return "\n".join(f"{m.role}: {m.content}" for m in messages)

    async def generate(
        self,
        messages: list[ProviderMessage],
        model: str | None = None,
        options: GenerateOptions | None = None,
    ) -> ProviderResponse:
        opts = options or GenerateOptions()
        timeout = opts.timeout_s or self.timeout_s
        # Model availability check (soft)
        if model:
            try:
                await self._ensure_model_available(model)
            except ModelNotFoundError:
                raise
            except ProviderUnavailableError:
                raise
            except ProviderError:
                # If list_models failed due to unavailable, surface that
                raise

        # Use /api/chat for message history
        url = f"{self.base_url}/api/chat"
        payload: dict[str, Any] = {
            "model": model or "llama3.1",
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": False,
        }
        if opts.temperature is not None:
            payload["options"] = {"temperature": opts.temperature}
        if opts.num_predict is not None:
            payload.setdefault("options", {})["num_predict"] = opts.num_predict
        if opts.extra:
            payload["extra"] = opts.extra

        client = self._get_client()
        close = self._client is None
        try:
            resp = await client.post(url, json=payload, timeout=timeout)
            if resp.status_code == 404:
                # May be model not found
                body = resp.text
                if "model" in body.lower():
                    raise ModelNotFoundError(model or payload["model"], provider="ollama")
                raise ProviderError(f"Ollama 404: {body}", provider="ollama")
            if resp.status_code != 200:
                raise ProviderError(f"Ollama generate failed HTTP {resp.status_code}: {resp.text[:500]}", provider="ollama")
            data = resp.json()
            content = data.get("message", {}).get("content") or data.get("response") or ""
            return ProviderResponse(
                content=content,
                model=data.get("model") or payload["model"],
                provider="ollama",
                done_reason=data.get("done_reason") or ("stop" if data.get("done") else None),
                raw=data,
            )
        except httpx.TimeoutException as e:
            raise ProviderTimeoutError(f"Ollama generate timeout after {timeout}s", provider="ollama", cause=e) from e
        except httpx.ConnectError as e:
            raise ProviderUnavailableError(f"Ollama not reachable at {self.base_url}: {e}", provider="ollama", cause=e) from e
        except (ModelNotFoundError, ProviderError):
            raise
        except Exception as e:
            raise ProviderError(f"Ollama generate error: {e}", provider="ollama", cause=e) from e
        finally:
            if close:
                await client.aclose()

    async def stream(
        self,
        messages: list[ProviderMessage],
        model: str | None = None,
        options: GenerateOptions | None = None,
    ) -> AsyncIterator[str]:
        opts = options or GenerateOptions()
        timeout = opts.timeout_s or self.timeout_s
        url = f"{self.base_url}/api/chat"
        payload: dict[str, Any] = {
            "model": model or "llama3.1",
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": True,
        }
        if opts.temperature is not None:
            payload["options"] = {"temperature": opts.temperature}

        client = self._get_client()
        close = self._client is None
        try:
            async with client.stream("POST", url, json=payload, timeout=timeout) as resp:
                if resp.status_code == 404:
                    body = await resp.aread()
                    txt = body.decode(errors="ignore")
                    if "model" in txt.lower():
                        raise ModelNotFoundError(model or payload["model"], provider="ollama")
                    raise ProviderError(f"Ollama stream 404: {txt[:500]}", provider="ollama")
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise ProviderError(f"Ollama stream failed HTTP {resp.status_code}: {body.decode(errors='ignore')[:500]}", provider="ollama")
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    chunk = data.get("message", {}).get("content") or data.get("response") or ""
                    if chunk:
                        yield chunk
                    if data.get("done"):
                        break
        except httpx.TimeoutException as e:
            raise ProviderTimeoutError(f"Ollama stream timeout after {timeout}s", provider="ollama", cause=e) from e
        except httpx.ConnectError as e:
            raise ProviderUnavailableError(f"Ollama not reachable at {self.base_url}: {e}", provider="ollama", cause=e) from e
        except (ModelNotFoundError, ProviderError, ProviderTimeoutError, ProviderUnavailableError):
            raise
        except asyncio.CancelledError:
            raise
        except Exception as e:
            raise ProviderError(f"Ollama stream error: {e}", provider="ollama", cause=e) from e
        finally:
            if close:
                await client.aclose()

    async def cancel(self, task_id: str | None = None) -> None:
        # Ollama has no native cancel; we support task cancellation via asyncio
        # This is a no-op placeholder for future extension
        return None

    # Backwards compat for Phase 1 tests
    async def complete(self, messages: list[ProviderMessage], model: str | None = None) -> ProviderResponse:  # type: ignore[override]
        return await self.generate(messages, model=model)
