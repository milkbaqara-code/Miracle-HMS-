# ============================================================
# MIRACLE OS WEB BUILDER — Project Management Router
# Save, load, and list user website projects
# ============================================================
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.wb_models import WbUser, WbProject
from app.routers.wb_auth import get_current_wb_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WB: Projects"])

# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class SaveProjectRequest(BaseModel):
    project_id: Optional[int] = None
    name: str = "My Site"
    layout_json: str = "{}"


class ProjectResponse(BaseModel):
    id: int
    name: str
    plan_tier: str
    is_published: bool
    created_at: str
    updated_at: str
    has_content: bool

    class Config:
        from_attributes = True


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _project_to_dict(p: WbProject, include_layout: bool = False) -> dict:
    data = {
        "id": p.id,
        "user_id": p.user_id,
        "name": p.name,
        "subdomain": p.subdomain,
        "custom_domain": p.custom_domain,
        "plan_tier": p.plan_tier,
        "is_published": p.is_published,
        "has_content": bool(p.layout_json and len(p.layout_json) > 2),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
    if include_layout:
        data["layout_json"] = p.layout_json
    return data


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/save")
def save_project(
    payload: SaveProjectRequest,
    current_user: WbUser = Depends(get_current_wb_user),
    db: Session = Depends(get_db),
):
    """
    Save or update a website project.
    - Free plan: max 1 project
    - Pro/Enterprise: unlimited
    """
    plan_name = current_user.plan.name if current_user.plan else "free"

    # Enforce free plan project limit
    if plan_name == "free":
        existing_count = db.query(WbProject).filter(WbProject.user_id == current_user.id).count()
        if existing_count >= 1 and not payload.project_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PROJECT_LIMIT_REACHED",
                    "message": "Free plan allows 1 project. Upgrade to Pro for unlimited projects.",
                    "upgrade_url": "/upgrade",
                },
            )

    now = datetime.now(timezone.utc)

    if payload.project_id:
        # Update existing project
        project = db.query(WbProject).filter(
            WbProject.id == payload.project_id,
            WbProject.user_id == current_user.id,
        ).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied.",
            )
        project.name = payload.name
        project.layout_json = payload.layout_json
        project.plan_tier = plan_name
        project.updated_at = now
        db.commit()
        db.refresh(project)
        logger.info(f"💾 WB PROJECT UPDATED: project_id={project.id}, user={current_user.email}")
    else:
        # Create new project
        project = WbProject(
            user_id=current_user.id,
            name=payload.name,
            layout_json=payload.layout_json,
            plan_tier=plan_name,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        logger.info(f"🆕 WB PROJECT CREATED: project_id={project.id}, user={current_user.email}")

    return {
        "success": True,
        "message": "Project saved successfully.",
        "project": _project_to_dict(project, include_layout=False),
    }


@router.get("/list")
def list_projects(
    current_user: WbUser = Depends(get_current_wb_user),
    db: Session = Depends(get_db),
):
    """Return all projects for the authenticated user (without layout data)."""
    projects = db.query(WbProject).filter(
        WbProject.user_id == current_user.id
    ).order_by(WbProject.updated_at.desc()).all()

    return {
        "success": True,
        "total": len(projects),
        "projects": [_project_to_dict(p) for p in projects],
    }


@router.get("/{project_id}")
def get_project(
    project_id: int,
    current_user: WbUser = Depends(get_current_wb_user),
    db: Session = Depends(get_db),
):
    """Return a single project with full layout_json for loading into the builder."""
    project = db.query(WbProject).filter(
        WbProject.id == project_id,
        WbProject.user_id == current_user.id,
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied.",
        )

    return {
        "success": True,
        "project": _project_to_dict(project, include_layout=True),
    }


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: WbUser = Depends(get_current_wb_user),
    db: Session = Depends(get_db),
):
    """Permanently delete a project."""
    project = db.query(WbProject).filter(
        WbProject.id == project_id,
        WbProject.user_id == current_user.id,
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied.")

    db.delete(project)
    db.commit()
    logger.info(f"🗑️ WB PROJECT DELETED: project_id={project_id}, user={current_user.email}")

    return {"success": True, "message": "Project deleted."}
