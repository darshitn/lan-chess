from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DbSession, PaginationDeps
from app.models.agent import Agent
from app.models.profile import Profile
from app.models.project import Project
from app.models.provider import Provider
from app.models.role import Role
from app.schemas.agent import AgentCreate, AgentOut, AgentUpdate

router = APIRouter(prefix="/agents", tags=["agents"])


def _validate_refs(db: DbSession, payload: AgentCreate | AgentUpdate, existing_project_id: str | None = None) -> None:
    # project must exist for create
    pid = getattr(payload, "project_id", None) or existing_project_id
    if pid and not db.get(Project, pid):
        raise HTTPException(status_code=400, detail="project_id not found")
    if getattr(payload, "role_id", None):
        if not db.get(Role, payload.role_id):  # type: ignore[union-attr]
            raise HTTPException(status_code=400, detail="role_id not found")
    if getattr(payload, "provider_id", None):
        if not db.get(Provider, payload.provider_id):  # type: ignore[union-attr]
            raise HTTPException(status_code=400, detail="provider_id not found")
    if getattr(payload, "profile_id", None):
        prof = db.get(Profile, payload.profile_id)  # type: ignore[union-attr]
        if not prof:
            raise HTTPException(status_code=400, detail="profile_id not found")


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate, db: DbSession) -> Agent:
    _validate_refs(db, payload)
    obj = Agent(
        project_id=payload.project_id,
        name=payload.name,
        role_id=payload.role_id,
        description=payload.description,
        system_prompt=payload.system_prompt,
        provider_id=payload.provider_id,
        model=payload.model,
        profile_id=payload.profile_id,
        status=payload.status,
        enabled=payload.enabled,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig) if hasattr(e, "orig") else str(e)
        if "UNIQUE" in msg or "unique" in msg.lower():
            raise HTTPException(status_code=409, detail="Agent name already exists in project")
        if "FOREIGN KEY" in msg or "foreign key" in msg.lower():
            raise HTTPException(status_code=400, detail="Foreign key constraint failed")
        raise HTTPException(status_code=400, detail="Failed to create agent")
    db.refresh(obj)
    return obj


@router.get("", response_model=list[AgentOut])
def list_agents(
    db: DbSession,
    pagination: PaginationDeps,
    project_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
) -> list[Agent]:
    stmt = select(Agent)
    if project_id:
        stmt = stmt.where(Agent.project_id == project_id)
    if status_filter:
        stmt = stmt.where(Agent.status == status_filter)
    stmt = stmt.order_by(Agent.created_at.desc()).offset(pagination["skip"]).limit(pagination["limit"])
    return list(db.execute(stmt).scalars().all())


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: str, db: DbSession) -> Agent:
    obj = db.get(Agent, agent_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Agent not found")
    return obj


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: str, payload: AgentUpdate, db: DbSession) -> Agent:
    obj = db.get(Agent, agent_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Agent not found")
    _validate_refs(db, payload, existing_project_id=obj.project_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig) if hasattr(e, "orig") else str(e)
        if "UNIQUE" in msg or "unique" in msg.lower():
            raise HTTPException(status_code=409, detail="Agent name already exists in project")
        raise HTTPException(status_code=400, detail="Failed to update agent")
    db.refresh(obj)
    return obj


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: str, db: DbSession) -> None:
    obj = db.get(Agent, agent_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(obj)
    db.commit()
    return None
