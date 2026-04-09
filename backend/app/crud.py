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
    existing_by_number = {
        round_item.roundNumber: round_item
        for round_item in db_application.interviewRounds
    }
    incoming_by_number = {
        round_item.roundNumber: round_item
        for round_item in rounds
    }

    # Remove rounds that are no longer present.
    db_application.interviewRounds[:] = [
        round_item
        for round_item in db_application.interviewRounds
        if round_item.roundNumber in incoming_by_number
    ]

    for round_number in sorted(incoming_by_number):
        incoming = incoming_by_number[round_number]
        existing = existing_by_number.get(round_number)
        if existing:
            existing.roundType = incoming.roundType
            existing.scheduledAt = incoming.scheduledAt
            existing.completedAt = incoming.completedAt
            existing.result = incoming.result
            existing.notes = incoming.notes
            continue

        db_application.interviewRounds.append(
            models.InterviewRound(
                roundNumber=incoming.roundNumber,
                roundType=incoming.roundType,
                scheduledAt=incoming.scheduledAt,
                completedAt=incoming.completedAt,
                result=incoming.result,
                notes=incoming.notes,
            )
        )
