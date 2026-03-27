from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

Stage = Literal[
    "Applied",
    "Applied with Referral",
    "Interview Scheduled",
    "Interviewed",
    "Followed Up",
    "Offered",
    "Rejected",
]

AppliedOn = Literal[
    "LinkedIn",
    "Greenhouse",
    "Ashby",
    "Lever",
    "Indeed",
    "Glassdoor",
    "Company Portal",
]
InterviewResult = Literal["Pending", "Pass", "Fail", "Cancelled"]


class InterviewRoundBase(BaseModel):
    roundNumber: int = Field(ge=1)
    roundType: Optional[str] = None
    scheduledAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    result: Optional[InterviewResult] = None
    notes: Optional[str] = None


class InterviewRound(InterviewRoundBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ResumeUsed(BaseModel):
    name: str
    url: Optional[str] = None


class ApplicationBase(BaseModel):
    company: str
    role: str
    location: Optional[str] = None
    stage: Stage
    appliedDate: date
    jobUrl: Optional[str] = None
    appliedOn: Optional[AppliedOn] = None
    referralDetails: Optional[str] = None
    interviewRounds: list[InterviewRoundBase] = Field(default_factory=list)
    jobDescription: str
    notes: str
    resumeUsed: Optional[ResumeUsed] = None

    @model_validator(mode="after")
    def validate_conditional_fields(self):
        if self.stage == "Applied with Referral":
            if not self.referralDetails or not self.referralDetails.strip():
                raise ValueError("referralDetails is required for Applied with Referral")
        if self.stage == "Applied":
            if self.referralDetails:
                raise ValueError("referralDetails must be empty for Applied stage")
            if self.interviewRounds:
                raise ValueError("interviewRounds must be empty before interview stages")
        if self.stage == "Applied with Referral" and self.interviewRounds:
            raise ValueError("interviewRounds must be empty before interview stages")
        if self.interviewRounds:
            numbers = [round_item.roundNumber for round_item in self.interviewRounds]
            if len(numbers) != len(set(numbers)):
                raise ValueError("interviewRounds roundNumber values must be unique")
        return self


class ApplicationCreate(ApplicationBase):
    id: str


class ApplicationUpdate(ApplicationBase):
    pass


class Application(ApplicationBase):
    id: str
    interviewRounds: list[InterviewRound] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class FlowTransition(BaseModel):
    source: str
    target: str
    count: int
