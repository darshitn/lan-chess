# Ollama

Local LLM provider via HTTP. Default `http://127.0.0.1:11434` only as fallback — URL is configurable.

## Configuration

- Env: `OLLAMA_HOST` or `OLLAMA_URL` (also `Settings.ollama_host` in `backend/app/core/config.py:1`), default `http://127.0.0.1:11434`, timeout `OLLAMA_TIMEOUT_S`/`ollama_timeout_s` default 30s.
- Per-provider override: `providers.config = {"base_url": "http://custom:11434"}` or `{"host": ...}` — honored by `OllamaProvider` (`backend/app/providers/ollama.py:1` → `_ollama_base_url`) and by runtime routes via `providers_runtime.py:1` `_resolve_provider`.
- Frontend can set `base_url` via `PATCH /api/providers/{id}` `{config: {base_url}}` then call health/models.

## Provider — `backend/app/providers/ollama.py:1`

- `is_configured()` true if URL set (even if daemon down); `health()` distinguishes.
- `health()`: `GET {base}/api/tags` (5s timeout) → `ProviderHealth{available, latency_ms}`; connect errors return `available=False, error`.
- `list_models()`: `GET /api/tags` → `ProviderModel{id, name, size, modified_at}`;  non-200 → `ProviderUnavailableError` (503), timeout → `ProviderTimeoutError` (408).
- `generate()`: `POST {base}/api/chat` `{model, messages, stream:false, options:{temperature, num_predict}}` with `timeout_s`; model availability checked via `list_models()` → `ModelNotFoundError` (404) if absent; 404 from chat with "model" in body also maps to 404; `ConnectError` → 503; `Timeout` → 408.
- `stream()`: `POST /api/chat {stream:true}` via `client.stream()` + `aiter_lines()` → yields `message.content`/`response` chunks, handles `done` flag; same error mapping; `CancelledError` propagates.
- `cancel()`: no native Ollama cancel — no-op (future task tokens).
- `supports_streaming()=True`, `supports_cancellation()=True`.

## Agent Model Management

- View status: `GET /api/providers/{ollama_id}/health` (no crash if down).
- View models: `GET /api/providers/{ollama_id}/models`.
- Select/assign: `PATCH /api/agents/{id}` `{model: "llama3:8b"}` or `{provider_id, model}`; `POST /api/agents/{id}/generate` then uses that model (`use_agent_model=true` default) — see `backend/app/agents/runner.py:1` and `schemas/provider_runtime.py:1` `AgentGenerateRequest`.
- Direct generate with explicit model: `POST /api/agents/{id}/generate` `{messages, model: "mistral:7b"}` overrides persisted.
- Model existence validated via provider `list_models()` before generate where feasible.

## Error States (never crash backend)

| Condition | Provider exception | HTTP |
|---|---|---|
| Ollama down / refuse | `ProviderUnavailableError` | 503 |
| Model missing | `ModelNotFoundError` | 404 |
| Timeout | `ProviderTimeoutError` | 408 |
| Generation/other | `ProviderError`/`GenerationError` | 502 |
| Stream error | SSE `event: error` + `event: done` | 200 (stream) |

All mapped in `api/routes/providers_runtime.py:1` and `agents_runtime.py:1` with `try/except` → `HTTPException`; health returns `available=False` instead of 5xx.

## Testing

- No real Ollama needed. `tests/test_ollama_provider.py:1` uses `httpx.MockTransport` + injected `AsyncClient` to mock `/api/tags`/`/api/chat`, verifies connection detection, model listing, availability, generation, timeouts, URL configurability.
- `tests/test_provider_runtime_api.py:1` mocks `OllamaProvider` methods via `monkeypatch` to test API error codes (503/408/404) and Demo streaming.
- `tests/test_provider_interface.py:1`/`test_demo_provider.py:1` verify interface completeness and DEMO labeling.
- Run: `pytest -q` (63 tests), `npm run typecheck`, `npm run build`.

## Manual Check (if Ollama installed)

```powershell
# default
ollama serve
ollama pull llama3.1
# backend will use http://127.0.0.1:11434 by default
# or
$env:OLLAMA_HOST="http://127.0.0.1:11434"; python -m uvicorn app.main:app --app-dir backend
# then in another shell:
# GET http://127.0.0.1:8000/api/providers/{id}/health ; /models ; POST /generate
```
