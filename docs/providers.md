# Providers

Provider abstraction isolates LLM backends from `Agent`/`orchestration`.

## Interface — `backend/app/providers/base.py:1`

```python
Provider.kind: Literal["demo","ollama","claude"]
is_configured() -> bool
health() -> ProviderHealth{available, latency_ms, error}
list_models() -> list[ProviderModel]
generate(messages, model?, options?) -> ProviderResponse
stream(messages, model?, options?) -> AsyncIterator[str]
cancel(task_id?) -> None
supports_streaming(), supports_cancellation()
capabilities() -> {kind, configured}
```

- `health` / `models` / `generate` / `stream` / `cancel` are the only required ops; providers that don't support `list_models` raise `ProviderError(code="unsupported")` rather than faking data.
- All errors are typed: `ProviderUnavailableError` (503), `ModelNotFoundError` (404), `ProviderTimeoutError` (408), `GenerationError`/`ProviderError` (502). Runtime routes never crash backend — they map to HTTP codes.
- `GenerateOptions{temperature, num_predict, timeout_s, extra}` keeps interface extensible.

## DemoProvider — `backend/app/providers/demo.py:1`

- Always `is_configured()=True`, `health().available=True`.
- `list_models()` returns `demo-model`, `demo-small` deterministically.
- `generate()` returns `[DEMO | {model}] echo: {last_user_message}` — **clearly labeled `DEMO`, never presented as real AI**.
- `stream()` chunks by words with 5ms delay — deterministic for tests.
- Used in all automated tests; no network.

## Registry — `backend/app/providers/registry.py:1`

```python
get_provider(kind, base_url?, timeout_s?) -> Provider
resolve_provider_for_agent(kind, config_url?) -> Provider
```

- `AgentRunner` (`backend/app/agents/runner.py:1`) calls `resolve_provider_for_agent(agent.provider.kind, config_url)`; **contains zero Ollama-specific code** (verified by `tests/test_agent_runner.py:1`).
- Provider `kind` normalization handles legacy `claude_api`/`claude_web`; `config.base_url`/`host` from `providers.config` JSON selects Ollama URL.

## Agent Execution

```
Agent (DB: provider_id, model, system_prompt)
  ↓  AgentRunner.run() / stream()
Provider abstraction (Provider.generate/stream)
  ↓  model id string
ProviderResponse{content, model, provider}
```

- System prompt injected as leading `system` message if not supplied.
- Model selection: `request.model` > `agent.model` (via `AgentGenerateRequest.use_agent_model`); `PATCH /api/agents/{id}` `{model}` reassigns persisted model — tested in `tests/test_agent_runner.py:1`.

## Runtime APIs

- `GET /api/providers/{id}/health` → `ProviderHealthOut` (Ollama: probes `GET /api/tags`).
- `GET /api/providers/{id}/models` → `list[ProviderModelOut]` (503/408/404 mapped).
- `POST /api/providers/{id}/generate` `{messages, model?, options?}` → `GenerateResponse`.
- `POST /api/providers/{id}/stream` → `text/event-stream` SSE (`data: chunk`, `event: error`, `event: done`).
- `POST /api/providers/{id}/cancel`
- `POST /api/agents/{id}/generate` / `stream` / `cancel` via `AgentRunner`.

See `docs/ollama.md` for Ollama details and `backend/app/api/routes/providers_runtime.py:1`, `agents_runtime.py:1`.
