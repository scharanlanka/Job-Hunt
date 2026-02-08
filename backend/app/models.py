from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(String, primary_key=True, index=True)
    company = Column(String, nullable=False)
    role = Column(String, nullable=False)
    location = Column(String)
    stage = Column(String, nullable=False)
    appliedDate = Column("applied_date", Date, nullable=False)
    jobUrl = Column("job_url", String)
    appliedOn = Column("applied_on", String)
    referralDetails = Column("referral_details", Text)
    jobDescription = Column("job_description", Text, nullable=False)
    notes = Column(Text, nullable=False)
    resumeName = Column("resume_name", String)
    resumeUrl = Column("resume_url", String)
    interviewRounds = relationship(
        "InterviewRound",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="InterviewRound.roundNumber",
    )
    events = relationship(
        "ApplicationEvent",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="ApplicationEvent.eventAt",
    )

    @property
    def resumeUsed(self):
        if not self.resumeName:
            return None
        return {"name": self.resumeName, "url": self.resumeUrl}


class InterviewRound(Base):
    __tablename__ = "interview_rounds"
    __table_args__ = (
        UniqueConstraint("application_id", "round_number", name="uq_interview_rounds_app_round"),
        CheckConstraint("round_number > 0", name="chk_interview_round_number_positive"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    applicationId = Column(
        "application_id", String, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    roundNumber = Column("round_number", Integer, nullable=False)
    roundType = Column("round_type", String)
    scheduledAt = Column("scheduled_at", DateTime)
    completedAt = Column("completed_at", DateTime)
    result = Column(String)
    notes = Column(Text)
    application = relationship("Application", back_populates="interviewRounds")


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    applicationId = Column(
        "application_id", String, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    eventType = Column("event_type", String, nullable=False)
    fromStage = Column("from_stage", String)
    toStage = Column("to_stage", String)
    failureType = Column("failure_type", String)
    notes = Column(Text)
    eventAt = Column("event_at", DateTime, nullable=False, server_default=func.now())
    application = relationship("Application", back_populates="events")
