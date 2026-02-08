from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas


def list_applications(db: Session) -> list[models.Application]:
    return db.query(models.Application).order_by(models.Application.appliedDate.desc()).all()


def get_application(db: Session, application_id: str) -> models.Application | None:
    return db.query(models.Application).filter(models.Application.id == application_id).first()


def create_application(
    db: Session, payload: schemas.ApplicationCreate
) -> models.Application:
    data = payload.model_dump(exclude={"resumeUsed", "interviewRounds"})
    db_application = models.Application(**data)
    _apply_resume(db_application, payload.resumeUsed)
    _sync_interview_rounds(db_application, payload.interviewRounds)
    db.add(db_application)
    db.add(
        models.ApplicationEvent(
            applicationId=db_application.id,
            eventType="application_created",
            fromStage=None,
            toStage=db_application.stage,
            eventAt=datetime.utcnow(),
        )
    )
    db.commit()
    db.refresh(db_application)
    return db_application


def update_application(
    db: Session, db_application: models.Application, payload: schemas.ApplicationUpdate
) -> models.Application:
    previous_stage = db_application.stage
    data = payload.model_dump(exclude={"resumeUsed", "interviewRounds"})
    for key, value in data.items():
        setattr(db_application, key, value)
    _apply_resume(db_application, payload.resumeUsed)
    _sync_interview_rounds(db_application, payload.interviewRounds)
    if previous_stage != db_application.stage:
        db.add(
            models.ApplicationEvent(
                applicationId=db_application.id,
                eventType="stage_changed",
                fromStage=previous_stage,
                toStage=db_application.stage,
                eventAt=datetime.utcnow(),
            )
        )
    db.commit()
    db.refresh(db_application)
    return db_application


def delete_application(db: Session, db_application: models.Application) -> None:
    db.delete(db_application)
    db.commit()


def get_flow_transitions(
    db: Session,
) -> Sequence[tuple[str | None, str | None, int]]:
    return (
        db.query(
            models.ApplicationEvent.fromStage,
            models.ApplicationEvent.toStage,
            func.count(models.ApplicationEvent.id),
        )
        .group_by(models.ApplicationEvent.fromStage, models.ApplicationEvent.toStage)
        .all()
    )


def _apply_resume(
    db_application: models.Application, resume: schemas.ResumeUsed | None
) -> None:
    if resume:
        db_application.resumeName = resume.name
        db_application.resumeUrl = resume.url
    else:
        db_application.resumeName = None
        db_application.resumeUrl = None


def _sync_interview_rounds(
    db_application: models.Application, rounds: list[schemas.InterviewRoundBase]
) -> None:
    db_application.interviewRounds.clear()
    for round_item in sorted(rounds, key=lambda item: item.roundNumber):
        db_application.interviewRounds.append(
            models.InterviewRound(
                roundNumber=round_item.roundNumber,
                roundType=round_item.roundType,
                scheduledAt=round_item.scheduledAt,
                completedAt=round_item.completedAt,
                result=round_item.result,
                notes=round_item.notes,
            )
        )
