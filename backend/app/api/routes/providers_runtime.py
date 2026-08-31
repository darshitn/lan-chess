from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.api.deps import DbSession
from app.models.provider import Provider as ProviderModel
from app.providers.base import (
    GenerateOptions,
    ModelNotFoundError,
    ProviderError,
    ProviderMessage,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.providers.registry import get_provider
from app.schemas.provider_runtime import (
    GenerateRequest,
    GenerateResponse,
    ProviderHealthOut,
    ProviderModelOut,
)

router = APIRouter(prefix="/providers/{provider_id}", tags=["providers-runtime"])


def _resolve_provider(db: DbSession, provider_id: str):
    pm = db.get(ProviderModel, provider_id)
    if not pm:
        raise HTTPException(status_code=404, detail="Provider not found")
    # config may contain base_url/host override
    config_url = None
    if isinstance(pm.config, dict):
        config_url = pm.config.get("base_url") or pm.config.get("host") or pm.config.get("ollama_host")
    try:
        provider = get_provider(pm.kind, base_url=config_url)  # type: ignore[arg-type]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return provider, pm


@router.get("/health", response_model=ProviderHealthOut)
async def provider_health(provider_id: str, db: DbSession) -> ProviderHealthOut:
    provider, _pm = _resolve_provider(db, provider_id)
    try:
        h = await provider.health()
        return ProviderHealthOut(available=h.available, provider=h.provider, latency_ms=h.latency_ms, error=h.error, details=h.details)
    except Exception as e:
        # Never crash backend
        return ProviderHealthOut(available=False, provider=provider.kind, error=str(e))


@router.get("/models", response_model=list[ProviderModelOut])
async def provider_models(provider_id: str, db: DbSession) -> list[ProviderModelOut]:
    provider, _pm = _resolve_provider(db, provider_id)
    try:
        models = await provider.list_models()
        return [ProviderModelOut(id=m.id, name=m.name, provider=m.provider, size=m.size, modified_at=m.modified_at, details=m.details) for m in models]
    except ModelNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ProviderTimeoutError as e:
        raise HTTPException(status_code=408, detail=str(e))
    except ProviderUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Provider error: {e}")


@router.post("/generate", response_model=GenerateResponse)
async def provider_generate(provider_id: str, payload: GenerateRequest, db: DbSession) -> GenerateResponse:
    provider, _pm = _resolve_provider(db, provider_id)
    messages = [ProviderMessage(role=m.role, content=m.content) for m in payload.messages]
    opts = None
    if payload.options:
        opts = GenerateOptions(
            temperature=payload.options.temperature,
            num_predict=payload.options.num_predict,
            timeout_s=payload.options.timeout_s,
            extra=payload.options.extra or {},
        )
    try:
        resp = await provider.generate(messages, model=payload.model, options=opts)
        return GenerateResponse(content=resp.content, model=resp.model, provider=resp.provider, done_reason=resp.done_reason)
    except ModelNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ProviderTimeoutError as e:
        raise HTTPException(status_code=408, detail=str(e))
    except ProviderUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")


@router.post("/stream")
async def provider_stream(provider_id: str, payload: GenerateRequest, db: DbSession):
    provider, _pm = _resolve_provider(db, provider_id)
    messages = [ProviderMessage(role=m.role, content=m.content) for m in payload.messages]
    opts = None
    if payload.options:
        opts = GenerateOptions(
            temperature=payload.options.temperature,
            num_predict=payload.options.num_predict,
            timeout_s=payload.options.timeout_s,
            extra=payload.options.extra or {},
        )

    async def gen():
        try:
            async for chunk in provider.stream(messages, model=payload.model, options=opts):
                yield f"data: {chunk}\n\n"
        except ModelNotFoundError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except ProviderTimeoutError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except ProviderUnavailableError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except ProviderError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: Generation failed: {e}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.post("/cancel")
async def provider_cancel(provider_id: str, db: DbSession) -> dict[str, str]:
    provider, _pm = _resolve_provider(db, provider_id)
    try:
        await provider.cancel()
        return {"status": "cancelled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
