from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    shooting_day_id: Mapped[int] = mapped_column(ForeignKey("shooting_days.id"))
    disruption_summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="running")  # running | proposed | approved | rejected | infeasible | failed
    candidates_generated: Mapped[int] = mapped_column(Integer, default=0)
    candidates_valid: Mapped[int] = mapped_column(Integer, default=0)
    recommended_schedule_version_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schedule_versions.id"), nullable=True)
    explanation: Mapped[str] = mapped_column(Text, default="")
    blocking_constraints: Mapped[list] = mapped_column(JSON, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    execution_ms: Mapped[int] = mapped_column(Integer, default=0)

    actions: Mapped[list["AgentAction"]] = relationship(back_populates="agent_run", cascade="all, delete-orphan")
    approvals: Mapped[list["Approval"]] = relationship(back_populates="agent_run", cascade="all, delete-orphan")


class AgentAction(Base):
    __tablename__ = "agent_actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_run_id: Mapped[int] = mapped_column(ForeignKey("agent_runs.id"))
    seq: Mapped[int] = mapped_column(Integer)
    tool_name: Mapped[str] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(String(300), default="")
    input_json: Mapped[dict] = mapped_column(JSON, default=dict)
    output_json: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="completed")  # completed | running | failed
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent_run: Mapped["AgentRun"] = relationship(back_populates="actions")


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_run_id: Mapped[int] = mapped_column(ForeignKey("agent_runs.id"))
    schedule_version_id: Mapped[int] = mapped_column(ForeignKey("schedule_versions.id"))
    decision: Mapped[str] = mapped_column(String(20))  # approved | rejected
    decided_by: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(String(300), default="")
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent_run: Mapped["AgentRun"] = relationship(back_populates="approvals")
