from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agents.runner import AgentRunRequest, AgentRunner
from app.api.deps import DbSession
from app.providers.base import GenerateOptions, ModelNotFoundError, ProviderError, ProviderMessage, ProviderTimeoutError, ProviderUnavailableError
from app.schemas.provider_runtime import AgentGenerateRequest, GenerateResponse

router = APIRouter(prefix="/agents/{agent_id}", tags=["agents-runtime"])
_runner = AgentRunner()


@router.post("/generate", response_model=GenerateResponse)
async def agent_generate(agent_id: str, payload: AgentGenerateRequest, db: DbSession) -> GenerateResponse:
    messages = [ProviderMessage(role=m.role, content=m.content) for m in payload.messages]
    opts = None
    if payload.options:
        opts = GenerateOptions(
            temperature=payload.options.temperature,
            num_predict=payload.options.num_predict,
            timeout_s=payload.options.timeout_s,
            extra=payload.options.extra or {},
        )
    # Model selection: payload.model if provided or agent's model via runner
    model = payload.model if payload.model is not None else (None if payload.use_agent_model else None)
    # When use_agent_model true and payload.model is None, runner will use agent.model
    req = AgentRunRequest(agent_id=agent_id, messages=messages, model=model, options=opts)
    try:
        result = await _runner.run(db, req)
        return GenerateResponse(content=result.content, model=result.model, provider=result.provider)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ModelNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ProviderTimeoutError as e:
        raise HTTPException(status_code=408, detail=str(e))
    except ProviderUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ProviderError as e:
        # Distinguish agent_disabled etc as 400
        if getattr(e, "code", None) == "agent_disabled":
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent generate failed: {e}")


@router.post("/stream")
async def agent_stream(agent_id: str, payload: AgentGenerateRequest, db: DbSession):
    messages = [ProviderMessage(role=m.role, content=m.content) for m in payload.messages]
    opts = None
    if payload.options:
        opts = GenerateOptions(
            temperature=payload.options.temperature,
            num_predict=payload.options.num_predict,
            timeout_s=payload.options.timeout_s,
            extra=payload.options.extra or {},
        )
    model = payload.model if payload.model is not None else (None if payload.use_agent_model else None)
    req = AgentRunRequest(agent_id=agent_id, messages=messages, model=model, options=opts)

    async def gen():
        try:
            async for chunk in _runner.stream(db, req):
                yield f"data: {chunk}\n\n"
        except ModelNotFoundError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except ProviderTimeoutError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except ProviderUnavailableError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except ProviderError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except ValueError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: Agent stream failed: {e}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.post("/cancel")
async def agent_cancel(agent_id: str) -> dict[str, str]:
    # Placeholder: cancels via provider if tracking task_id; here just acknowledges
    return {"status": "cancelled", "agent_id": agent_id}
