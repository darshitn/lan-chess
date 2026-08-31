from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import AsyncIterator

from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.provider import Provider as ProviderModel
from app.providers.base import (
    GenerateOptions,
    Provider,
    ProviderError,
    ProviderMessage,
    ProviderResponse,
)
from app.providers.registry import resolve_provider_for_agent


@dataclass(frozen=True)
class AgentRunRequest:
    agent_id: str
    messages: list[ProviderMessage]
    model: str | None = None
    options: GenerateOptions | None = None


@dataclass(frozen=True)
class AgentRunResult:
    content: str
    model: str
    provider: str
    raw: ProviderResponse | None = None


class AgentRunner:
    """Provider-agnostic Agent execution: Agent -> Provider abstraction -> Model -> Response.
    Contains NO Ollama-specific code."""

    def __init__(self, provider_factory=None):
        # provider_factory(agent) -> Provider for test injection
        self._provider_factory = provider_factory

    def _resolve_provider(self, db: Session, agent: Agent) -> Provider:
        if self._provider_factory is not None:
            return self._provider_factory(agent)
        # Determine provider kind via agent.provider relationship or fallback to agent.model/provider_id config
        provider_kind = "demo"
        config_url = None
        if agent.provider is not None:
            provider_kind = agent.provider.kind  # type: ignore[attr-defined]
            if isinstance(agent.provider.config, dict):
                config_url = agent.provider.config.get("base_url") or agent.provider.config.get("host")
        elif agent.provider_id:
            # Load provider model to get kind
            pm = db.get(ProviderModel, agent.provider_id)
            if pm:
                provider_kind = pm.kind
                if isinstance(pm.config, dict):
                    config_url = pm.config.get("base_url") or pm.config.get("host")
        # Agent model selection precedes provider default
        return resolve_provider_for_agent(provider_kind, provider_config_url=config_url)

    async def run(self, db: Session, request: AgentRunRequest) -> AgentRunResult:
        agent = db.get(Agent, request.agent_id)
        if not agent:
            raise ValueError(f"Agent not found: {request.agent_id}")
        if not agent.enabled:
            raise ProviderError(f"Agent disabled: {agent.name}", code="agent_disabled", provider="demo")  # type: ignore[arg-type]
        provider = self._resolve_provider(db, agent)
        # Merge system_prompt from agent/role if present as leading system message when not already provided
        messages = list(request.messages)
        if agent.system_prompt and not any(m.role == "system" for m in messages):
            messages.insert(0, ProviderMessage(role="system", content=agent.system_prompt))
        # Model selection: request.model > agent.model > provider default
        model = request.model or agent.model
        # Validate configured
        # We allow generate to surface unavailable, but we can early check health if desired
        resp = await provider.generate(messages, model=model, options=request.options)
        return AgentRunResult(content=resp.content, model=resp.model, provider=resp.provider, raw=resp)

    async def stream(self, db: Session, request: AgentRunRequest) -> AsyncIterator[str]:
        agent = db.get(Agent, request.agent_id)
        if not agent:
            raise ValueError(f"Agent not found: {request.agent_id}")
        provider = self._resolve_provider(db, agent)
        messages = list(request.messages)
        if agent.system_prompt and not any(m.role == "system" for m in messages):
            messages.insert(0, ProviderMessage(role="system", content=agent.system_prompt))
        model = request.model or agent.model
        async for chunk in provider.stream(messages, model=model, options=request.options):
            yield chunk

    async def cancel(self, provider: Provider, task_id: str | None = None) -> None:
        await provider.cancel(task_id)
