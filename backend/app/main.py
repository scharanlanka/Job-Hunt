from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, models, schemas, storage
from .database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Job Hunt API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/uploads/resume", status_code=status.HTTP_201_CREATED)
def upload_resume(file: UploadFile = File(...)):
    return storage.upload_resume(file)


@app.get("/applications", response_model=list[schemas.Application])
def list_applications(db: Session = Depends(get_db)):
    return crud.list_applications(db)


@app.get("/applications/{application_id}", response_model=schemas.Application)
def get_application(application_id: str, db: Session = Depends(get_db)):
    application = crud.get_application(db, application_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return application


@app.post(
    "/applications",
    response_model=schemas.Application,
    status_code=status.HTTP_201_CREATED,
)
def create_application(
    payload: schemas.ApplicationCreate, db: Session = Depends(get_db)
):
    existing = crud.get_application(db, payload.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Application already exists"
        )
    return crud.create_application(db, payload)


@app.put("/applications/{application_id}", response_model=schemas.Application)
def update_application(
    application_id: str,
    payload: schemas.ApplicationUpdate,
    db: Session = Depends(get_db),
):
    application = crud.get_application(db, application_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return crud.update_application(db, application, payload)


@app.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: str, db: Session = Depends(get_db)):
    application = crud.get_application(db, application_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    crud.delete_application(db, application)
    return None


@app.get("/analytics/flow", response_model=list[schemas.FlowTransition])
def flow_analytics(db: Session = Depends(get_db)):
    rows = crud.get_flow_transitions(db)
    transitions: list[schemas.FlowTransition] = []
    for source, target, count in rows:
        transitions.append(
            schemas.FlowTransition(
                source=source or "Jobs Applied",
                target=target or "Unknown",
                count=count,
            )
        )
    return transitions
