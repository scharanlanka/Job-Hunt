"use client";

import { useMemo, useState } from "react";
import {
  Application,
  InterviewRound,
  Stage,
  STAGES,
  useApplications,
} from "./applications-context";
import { useTheme } from "./theme-context";

type ViewMode = "table" | "kanban";
type ListSort =
  | "company-asc"
  | "company-desc"
  | "date-newest"
  | "date-oldest";

type DrawerState =
  | { mode: "create"; stage: Stage }
  | { mode: "edit"; application: Application }
  | null;

type ResumePreviewState = {
  url: string;
  name: string;
} | null;

const APPLIED_ON_OPTIONS = [
  "LinkedIn",
  "Greenhouse",
  "Ashby",
  "Lever",
  "Indeed",
  "Glassdoor",
  "Company Portal",
] as const;

const stageStyles: Record<Stage, { bg: string; border: string; text: string }> =
  {
    Applied: {
      bg: "var(--stage-applied-bg)",
      border: "var(--stage-applied-border)",
      text: "var(--stage-applied-text)",
    },
    "Applied with Referral": {
      bg: "var(--stage-applied-bg)",
      border: "var(--stage-applied-border)",
      text: "var(--stage-applied-text)",
    },
    "Interview Scheduled": {
      bg: "var(--stage-scheduled-bg)",
      border: "var(--stage-scheduled-border)",
      text: "var(--stage-scheduled-text)",
    },
    Interviewed: {
      bg: "var(--stage-interviewed-bg)",
      border: "var(--stage-interviewed-border)",
      text: "var(--stage-interviewed-text)",
    },
    "Followed Up": {
      bg: "var(--stage-followed-bg)",
      border: "var(--stage-followed-border)",
      text: "var(--stage-followed-text)",
    },
    Offered: {
      bg: "var(--stage-offered-bg)",
      border: "var(--stage-offered-border)",
      text: "var(--stage-offered-text)",
    },
    Rejected: {
      bg: "var(--stage-rejected-bg)",
      border: "var(--stage-rejected-border)",
      text: "var(--stage-rejected-text)",
    },
  };

const stageIcon: Record<Stage, string> = {
  Applied: "A",
  "Applied with Referral": "AR",
  "Interview Scheduled": "S",
  Interviewed: "I",
  "Followed Up": "F",
  Offered: "O",
  Rejected: "R",
};

function formatDate(date: string) {
  const localDateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (localDateMatch) {
    const [, year, month, day] = localDateMatch;
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthIndex = Number(month) - 1;
    if (monthIndex >= 0 && monthIndex < monthNames.length) {
      return `${monthNames[monthIndex]} ${Number(day)}, ${year}`;
    }
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const stageOrder = STAGES.reduce(
  (acc, stage, index) => {
    acc[stage] = index;
    return acc;
  },
  {} as Record<Stage, number>
);

function stageAtLeast(current: Stage, target: Stage) {
  return stageOrder[current] >= stageOrder[target];
}

function applyStageChange(application: Application, nextStage: Stage) {
  if (nextStage === "Applied") {
    return {
      ...application,
      stage: nextStage,
      referralDetails: undefined,
      interviewRounds: [],
    };
  }
  if (nextStage === "Applied with Referral") {
    return {
      ...application,
      stage: nextStage,
      interviewRounds: [],
    };
  }
  return { ...application, stage: nextStage };
}

function buildEmptyApplication(stage: Stage): Application {
  return {
    id: "",
    company: "",
    role: "",
    location: "",
    stage,
    appliedDate: todayISO(),
    jobUrl: "",
    appliedOn: "LinkedIn",
    referralDetails: "",
    interviewRounds: [],
    jobDescription: "",
    notes: "",
    resumeUsed: undefined,
  };
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `app-${Date.now()}`;
}

function normalizeForSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

function detectAppliedOnFromUrl(
  url: string
): (typeof APPLIED_ON_OPTIONS)[number] {
  const normalized = url.toLocaleLowerCase();
  if (/linkedin\.com/.test(normalized)) {
    return "LinkedIn";
  }
  if (/greenhouse\.io/.test(normalized)) {
    return "Greenhouse";
  }
  if (/ashbyhq\.com|ashby\.jobs/.test(normalized)) {
    return "Ashby";
  }
  if (/lever\.co/.test(normalized)) {
    return "Lever";
  }
  if (/indeed\./.test(normalized)) {
    return "Indeed";
  }
  if (/glassdoor\./.test(normalized)) {
    return "Glassdoor";
  }
  return "Company Portal";
}

function StagePill({ stage }: { stage: Stage }) {
  const style = stageStyles[stage];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
      }}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-semibold">
        {stageIcon[stage]}
      </span>
      {stage}
    </span>
  );
}

function StageSelect({
  value,
  onChange,
  compact,
}: {
  value: Stage;
  onChange: (value: Stage) => void;
  compact?: boolean;
}) {
  const style = stageStyles[value];
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
        compact ? "px-2" : "px-3"
      }`}
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-semibold">
        {stageIcon[value]}
      </span>
      <select
        className="cursor-pointer bg-transparent text-xs font-medium focus:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value as Stage)}
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {stage}
          </option>
        ))}
      </select>
    </label>
  );
}

function HeaderActions({
  onCreate,
  view,
  setView,
  companyQuery,
  setCompanyQuery,
  listSort,
  setListSort,
}: {
  onCreate: () => void;
  view: ViewMode;
  setView: (view: ViewMode) => void;
  companyQuery: string;
  setCompanyQuery: (value: string) => void;
  listSort: ListSort;
  setListSort: (value: ListSort) => void;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1">
        <button
          type="button"
          onClick={() => setView("table")}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            view === "table"
              ? "bg-[var(--surface)] text-[var(--text)]"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          All applications
        </button>
        <button
          type="button"
          onClick={() => setView("kanban")}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            view === "kanban"
              ? "bg-[var(--surface)] text-[var(--text)]"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          By stage
        </button>
      </div>
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <label className="sr-only" htmlFor="company-search">
          Search company
        </label>
        <input
          id="company-search"
          type="search"
          value={companyQuery}
          onChange={(event) => setCompanyQuery(event.target.value)}
          placeholder="Search company"
          className="h-9 w-48 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none md:w-60"
        />
        <label className="sr-only" htmlFor="company-sort">
          Sort company
        </label>
        <select
          id="company-sort"
          value={listSort}
          onChange={(event) => setListSort(event.target.value as ListSort)}
          className="h-9 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)] focus:outline-none"
        >
          <option value="company-asc">Company A-Z</option>
          <option value="company-desc">Company Z-A</option>
          <option value="date-newest">Date newest</option>
          <option value="date-oldest">Date oldest</option>
        </select>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:bg-[var(--accent-strong)]"
      >
        New
        <span className="text-xs">+</span>
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
        title="Toggle theme"
      >
        {theme === "dark" ? "☾" : "☀"}
      </button>
    </div>
  );
}

function ApplicationsTable({
  applications,
  selectedApplicationId,
  onSelectApplication,
  onClosePreview,
  onEdit,
  onPreviewResume,
}: {
  applications: Application[];
  selectedApplicationId: string | null;
  onSelectApplication: (applicationId: string) => void;
  onClosePreview: () => void;
  onEdit: (application: Application) => void;
  onPreviewResume: (resume: { url: string; name: string }) => void;
}) {
  const { updateApplication } = useApplications();
  const selectedApplication =
    applications.find((application) => application.id === selectedApplicationId) ??
    null;

  const openResumePreview = (application: Application) => {
    if (!application.resumeUsed?.url) {
      window.alert("No resume URL found for this application.");
      return;
    }
    onPreviewResume({
      url: application.resumeUsed.url,
      name: application.resumeUsed.name || "Resume",
    });
  };

  return (
    <div
      className={`grid h-full min-h-0 gap-4 overflow-hidden ${
        selectedApplication
          ? "xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]"
          : "grid-cols-1"
      }`}
    >
      <div className="flex h-full flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <span>All applications</span>
          <span className="font-mono text-[11px]">{applications.length} total</span>
        </div>
        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="flex h-full min-w-[1080px] flex-col">
            <div className="grid grid-cols-[220px_180px_140px_220px_160px_120px_140px_1fr] gap-4 border-b border-[var(--border)] px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Company</span>
              <span>Stage</span>
              <span>Applied On</span>
              <span>Role</span>
              <span>Location</span>
              <span>Resume</span>
              <span>Applied Date</span>
              <span>Job Description</span>
            </div>
            <div className="apps-scrollbar h-[calc(100vh-360px)] overflow-y-scroll">
              <div className="divide-y divide-[var(--border)]">
                {applications.map((application, index) => {
                  const isSelected = selectedApplication?.id === application.id;
                  return (
                    <div
                      key={application.id}
                      className={`group grid cursor-pointer grid-cols-[220px_180px_140px_220px_160px_120px_140px_1fr] gap-4 px-6 py-4 text-sm transition animate-rise ${
                        isSelected
                          ? "bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--accent)]"
                          : "hover:bg-[var(--surface-2)]"
                      }`}
                      style={{ animationDelay: `${index * 40}ms` }}
                      onClick={() => onEdit(application)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--muted)]">
                          {application.company.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="font-semibold text-[var(--text)]">
                          {application.company}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <StageSelect
                          value={application.stage}
                          onChange={(stage) => {
                            void updateApplication(applyStageChange(application, stage));
                          }}
                        />
                      </div>
                      <div className="text-[var(--muted)]">
                        {application.appliedOn ?? "N/A"}
                      </div>
                      <div className="text-[var(--text)]">{application.role}</div>
                      <div className="text-[var(--muted)]">
                        {application.location || "N/A"}
                      </div>
                      <div>
                        {application.resumeUsed?.name ? (
                          <button
                            type="button"
                            title="Preview resume"
                            onClick={(event) => {
                              event.stopPropagation();
                              openResumePreview(application);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] transition hover:text-[var(--text)]"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-[var(--muted)]">N/A</span>
                        )}
                      </div>
                      <div className="text-[var(--muted)]">
                        {formatDate(application.appliedDate)}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectApplication(application.id);
                          }}
                          className="line-clamp-2 text-left text-[var(--muted)] transition hover:text-[var(--text)]"
                          title={
                            application.jobDescription?.trim()
                              ? "Open JD preview"
                              : "No JD text saved"
                          }
                        >
                          {application.jobDescription?.trim() || "No JD saved"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      {selectedApplication ? (
        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Job description preview
            </p>
            <button
              type="button"
              onClick={onClosePreview}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              Close
            </button>
          </div>
          <div className="mt-3 space-y-2">
            <h3 className="text-xl font-semibold text-[var(--text)]">
              {selectedApplication.company} - {selectedApplication.role}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <StagePill stage={selectedApplication.stage} />
              <span>{selectedApplication.location || "Location not set"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onEdit(selectedApplication)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
              >
                Edit details
              </button>
              {selectedApplication.jobUrl ? (
                <a
                  href={selectedApplication.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
                >
                  Open posting
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          {selectedApplication?.jobDescription?.trim() ? (
            <div className="jd-scrollbar h-[calc(100vh-460px)] min-h-[220px] overflow-y-scroll rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text)]">
                {selectedApplication.jobDescription}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No job description saved for this application yet.
            </p>
          )}
        </div>
        </aside>
      ) : null}
    </div>
  );
}

function ResumePreviewModal({
  resume,
  onClose,
}: {
  resume: ResumePreviewState;
  onClose: () => void;
}) {
  if (!resume) {
    return null;
  }

  const previewUrl = `/api/uploads/resume/view?url=${encodeURIComponent(
    resume.url
  )}#page=1&zoom=page-width&navpanes=0&scrollbar=1`;
  const downloadUrl = `/api/uploads/resume/view?url=${encodeURIComponent(resume.url)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <p className="truncate text-sm font-semibold text-[var(--text)]">
            {resume.name}
          </p>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              download={resume.name}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              Close
            </button>
          </div>
        </div>
        <div className="h-full overflow-hidden bg-[var(--surface-2)]">
          <iframe
            title={resume.name}
            src={previewUrl}
            className="-mt-14 h-[calc(100%+56px)] w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}

function ApplicationsKanban({
  applications,
  onCreate,
  onEdit,
}: {
  applications: Application[];
  onCreate: (stage: Stage) => void;
  onEdit: (application: Application) => void;
}) {
  const { updateApplication } = useApplications();

  const grouped = useMemo(() => {
    return STAGES.reduce((acc, stage) => {
      acc[stage] = applications.filter((app) => app.stage === stage);
      return acc;
    }, {} as Record<Stage, Application[]>);
  }, [applications]);

  return (
    <div className="h-full">
      <div className="flex h-full gap-4 overflow-x-auto pb-6">
        {STAGES.map((stage, index) => {
          const column = grouped[stage];
          return (
            <div
              key={stage}
              className="flex h-full min-w-[250px] flex-1 animate-rise"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex h-full flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
                <div className="flex items-center justify-between">
                  <StagePill stage={stage} />
                  <span className="text-xs text-[var(--muted)]">
                    {column.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onCreate(stage)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
                >
                  + New page
                </button>
                <div className="mt-4 flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
                  {column.map((application) => (
                    <button
                      key={application.id}
                      type="button"
                      onClick={() => onEdit(application)}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-left transition hover:border-[var(--accent)]"
                    >
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {application.company}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {application.role}
                      </div>
                      <div className="mt-3">
                        <StageSelect
                          value={application.stage}
                          onChange={(nextStage) => {
                            void updateApplication({
                              ...applyStageChange(application, nextStage),
                            });
                          }}
                          compact
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApplicationDrawer({
  state,
  onClose,
  onSave,
  onDelete,
  onUploadResume,
}: {
  state: DrawerState;
  onClose: () => void;
  onSave: (application: Application) => Promise<void>;
  onDelete: (applicationId: string) => Promise<void>;
  onUploadResume: (file: File) => Promise<{ name: string; url: string }>;
}) {
  const [form, setForm] = useState<Application>(() =>
    state?.mode === "edit"
      ? state.application
      : buildEmptyApplication(state?.mode === "create" ? state.stage : "Applied")
  );

  const isOpen = Boolean(state);
  const isEditing = state?.mode === "edit";
  const [selectedResumeFile, setSelectedResumeFile] = useState<File | null>(null);

  if (!isOpen) {
    return null;
  }

  const updateForm = <K extends keyof Application>(
    key: K,
    value: Application[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateInterviewRound = (
    roundNumber: number,
    key: keyof InterviewRound,
    value: InterviewRound[keyof InterviewRound]
  ) => {
    setForm((current) => ({
      ...current,
      interviewRounds: (current.interviewRounds ?? []).map((round) =>
        round.roundNumber === roundNumber ? { ...round, [key]: value } : round
      ),
    }));
  };

  const addInterviewRound = () => {
    setForm((current) => {
      const maxRound = (current.interviewRounds ?? []).reduce(
        (max, round) => Math.max(max, round.roundNumber),
        0
      );
      return {
        ...current,
        interviewRounds: [
          ...(current.interviewRounds ?? []),
          {
            roundNumber: maxRound + 1,
            roundType: "",
            scheduledAt: "",
            completedAt: "",
            result: "Pending",
            notes: "",
          },
        ],
      };
    });
  };

  const removeInterviewRound = (roundNumber: number) => {
    setForm((current) => ({
      ...current,
      interviewRounds: (current.interviewRounds ?? []).filter(
        (round) => round.roundNumber !== roundNumber
      ),
    }));
  };

  const handleStageChange = (nextStage: Stage) => {
    setForm((current) => {
      if (nextStage === "Applied") {
        return {
          ...current,
          stage: nextStage,
          referralDetails: "",
          interviewRounds: [],
        };
      }
      if (nextStage === "Applied with Referral") {
        return {
          ...current,
          stage: nextStage,
          interviewRounds: [],
        };
      }
      return { ...current, stage: nextStage };
    });
  };

  const isValid = Boolean(
    form.company.trim() &&
      form.role.trim() &&
      (form.stage !== "Applied with Referral" || form.referralDetails?.trim()) &&
      form.resumeUsed?.name
  );
  const showReferralDetails = form.stage === "Applied with Referral";
  const showInterviewRounds = stageAtLeast(form.stage, "Interview Scheduled");

  const handleSave = async () => {
    if (!isValid) {
      return;
    }
    let resumeUsed = form.resumeUsed?.name ? form.resumeUsed : undefined;
    if (selectedResumeFile) {
      const uploaded = await onUploadResume(selectedResumeFile);
      resumeUsed = {
        name: uploaded.name,
        url: uploaded.url,
      };
    }

    const cleaned: Application = {
      ...form,
      id: form.id || createId(),
      company: form.company.trim(),
      role: form.role.trim(),
      location: form.location?.trim() ? form.location.trim() : undefined,
      jobUrl: form.jobUrl?.trim() ? form.jobUrl.trim() : undefined,
      appliedOn: form.appliedOn ?? "LinkedIn",
      referralDetails: form.referralDetails?.trim()
        ? form.referralDetails.trim()
        : undefined,
      interviewRounds: (form.interviewRounds ?? [])
        .map((round) => ({
          ...round,
          roundType: round.roundType?.trim() ? round.roundType.trim() : undefined,
          notes: round.notes?.trim() ? round.notes.trim() : undefined,
          scheduledAt: round.scheduledAt?.trim() ? round.scheduledAt : undefined,
          completedAt: round.completedAt?.trim() ? round.completedAt : undefined,
        }))
        .sort((a, b) => a.roundNumber - b.roundNumber),
      resumeUsed,
    };
    await onSave(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-[520px] animate-rise border-l border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {isEditing ? "Edit application" : "New application"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">
              {form.company || "Untitled"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
              Company
              <input
                type="text"
                value={form.company}
                onChange={(event) => updateForm("company", event.target.value)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                placeholder="Company name"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
              Role
              <input
                type="text"
                value={form.role}
                onChange={(event) => updateForm("role", event.target.value)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                placeholder="Role title"
                required
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
              Location
              <input
                type="text"
                value={form.location}
                onChange={(event) => updateForm("location", event.target.value)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                placeholder="City, State"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
              Stage
              <select
                value={form.stage}
                onChange={(event) =>
                  handleStageChange(event.target.value as Stage)
                }
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
            Applied Date
            <input
              type="date"
              value={form.appliedDate}
              onChange={(event) => updateForm("appliedDate", event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
            Job URL
            <input
              type="url"
              value={form.jobUrl ?? ""}
              onChange={(event) => {
                const nextUrl = event.target.value;
                updateForm("jobUrl", nextUrl);
                if (nextUrl.trim()) {
                  updateForm("appliedOn", detectAppliedOnFromUrl(nextUrl));
                }
              }}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
              placeholder="https://..."
            />
          </label>
          <fieldset className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
            <legend className="text-xs font-semibold text-[var(--muted)]">
              Applied On
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {APPLIED_ON_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text)]"
                >
                  <input
                    type="radio"
                    name="appliedOn"
                    value={option}
                    checked={(form.appliedOn ?? "LinkedIn") === option}
                    onChange={() => updateForm("appliedOn", option)}
                    className="h-3 w-3 accent-[var(--accent)]"
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
          {showReferralDetails ? (
            <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
              Referral Details
              <textarea
                value={form.referralDetails ?? ""}
                onChange={(event) =>
                  updateForm("referralDetails", event.target.value)
                }
                className="min-h-[96px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                placeholder="Who referred you, context, contact info"
              />
            </label>
          ) : null}
          {showInterviewRounds ? (
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-[var(--muted)]">
                Interview Rounds
              </legend>
              <div className="space-y-3">
                {(form.interviewRounds ?? [])
                  .slice()
                  .sort((a, b) => a.roundNumber - b.roundNumber)
                  .map((round) => (
                    <div
                      key={round.roundNumber}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--muted)]">
                          Round {round.roundNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeInterviewRound(round.roundNumber)}
                          className="rounded-full border border-red-400/40 px-3 py-1 text-[11px] font-semibold text-red-300 transition hover:border-red-400 hover:text-red-200"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
                          Type
                          <input
                            type="text"
                            value={round.roundType ?? ""}
                            onChange={(event) =>
                              updateInterviewRound(
                                round.roundNumber,
                                "roundType",
                                event.target.value
                              )
                            }
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                            placeholder="Phone, Technical, Final..."
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
                          Result
                          <select
                            value={round.result ?? "Pending"}
                            onChange={(event) =>
                              updateInterviewRound(
                                round.roundNumber,
                                "result",
                                event.target.value as InterviewRound["result"]
                              )
                            }
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                          >
                            {["Pending", "Pass", "Fail", "Cancelled"].map((result) => (
                              <option key={result} value={result}>
                                {result}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
                          Scheduled At
                          <input
                            type="datetime-local"
                            value={round.scheduledAt ?? ""}
                            onChange={(event) =>
                              updateInterviewRound(
                                round.roundNumber,
                                "scheduledAt",
                                event.target.value
                              )
                            }
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
                          Completed At
                          <input
                            type="datetime-local"
                            value={round.completedAt ?? ""}
                            onChange={(event) =>
                              updateInterviewRound(
                                round.roundNumber,
                                "completedAt",
                                event.target.value
                              )
                            }
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                          />
                        </label>
                      </div>
                      <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
                        Notes
                        <textarea
                          value={round.notes ?? ""}
                          onChange={(event) =>
                            updateInterviewRound(
                              round.roundNumber,
                              "notes",
                              event.target.value
                            )
                          }
                          className="min-h-[72px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                          placeholder="Interviewer feedback, next steps"
                        />
                      </label>
                    </div>
                  ))}
              </div>
              <button
                type="button"
                onClick={addInterviewRound}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
              >
                + Add interview round
              </button>
            </fieldset>
          ) : null}
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
            Job Description
            <textarea
              value={form.jobDescription}
              onChange={(event) =>
                updateForm("jobDescription", event.target.value)
              }
              className="min-h-[96px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
              placeholder="Role summary"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              className="min-h-[96px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
              placeholder="Follow-ups, contacts, reminders"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--muted)]">
            Resume
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setSelectedResumeFile(file ?? null);
                updateForm(
                  "resumeUsed",
                  file
                    ? { name: file.name, url: form.resumeUsed?.url }
                    : form.resumeUsed?.url
                      ? form.resumeUsed
                      : undefined
                );
              }}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            {isEditing ? (
              <button
                type="button"
                onClick={() => {
                  void onDelete(form.id);
                }}
                className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-semibold text-red-300 transition hover:border-red-400 hover:text-red-200"
              >
                Delete
              </button>
            ) : (
              <span className="text-xs text-[var(--muted)]">
                Connected to backend API
              </span>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={!isValid}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEditing ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const {
    applications,
    loading,
    error,
    createApplication,
    updateApplication,
    deleteApplication,
    uploadResume,
  } = useApplications();
  const [view, setView] = useState<ViewMode>("table");
  const [companyQuery, setCompanyQuery] = useState("");
  const [listSort, setListSort] = useState<ListSort>("date-newest");
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [resumePreview, setResumePreview] = useState<ResumePreviewState>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(
    null
  );

  const stats = useMemo(() => {
    const latest = applications
      .slice()
      .sort((a, b) => b.appliedDate.localeCompare(a.appliedDate))[0];
    const activeCount = applications.filter(
      (application) => application.stage !== "Rejected"
    ).length;
    return {
      total: activeCount,
      latest: latest ? formatDate(latest.appliedDate) : "N/A",
    };
  }, [applications]);

  const visibleApplications = useMemo(() => {
    const normalizedQuery = normalizeForSearch(companyQuery);
    const filtered = normalizedQuery
      ? applications.filter((application) =>
          normalizeForSearch(application.company).includes(normalizedQuery)
        )
      : applications.slice();
    filtered.sort((a, b) => {
      if (listSort === "date-newest") {
        const dateOrder = b.appliedDate.localeCompare(a.appliedDate);
        if (dateOrder !== 0) {
          return dateOrder;
        }
      }
      if (listSort === "date-oldest") {
        const dateOrder = a.appliedDate.localeCompare(b.appliedDate);
        if (dateOrder !== 0) {
          return dateOrder;
        }
      }
      const companyOrder = a.company.localeCompare(b.company, undefined, {
        sensitivity: "base",
      });
      if (listSort === "company-desc") {
        return -companyOrder;
      }
      return companyOrder;
    });
    return filtered;
  }, [applications, companyQuery, listSort]);

  const resolvedSelectedApplicationId = useMemo(() => {
    if (!selectedApplicationId) {
      return null;
    }
    const selectedStillVisible = visibleApplications.some(
      (application) => application.id === selectedApplicationId
    );
    return selectedStillVisible ? selectedApplicationId : null;
  }, [visibleApplications, selectedApplicationId]);

  return (
    <div className="flex h-screen flex-col overflow-hidden px-6 pb-6 pt-10 md:px-10">
      <div className="mx-auto flex w-full max-w-none flex-1 min-h-0 flex-col">
        <header className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-6 text-sm text-[var(--muted)]">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs">
                JH
              </span>
              <span className="uppercase tracking-[0.25em] text-xs">
                Job Hunt / Applications
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs">Updated {stats.latest}</span>
              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">
                {stats.total} active
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[var(--text)]">
                Applications
              </h1>
              <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
                A calm, single source of truth for every role you touched this
                season.
              </p>
            </div>
            <HeaderActions
              onCreate={() => setDrawerState({ mode: "create", stage: "Applied" })}
              view={view}
              setView={setView}
              companyQuery={companyQuery}
              setCompanyQuery={setCompanyQuery}
              listSort={listSort}
              setListSort={setListSort}
            />
          </div>
        </header>

        <div className="mt-6 flex-1 min-h-0">
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
              Backend error: {error}
            </div>
          ) : null}
          {loading ? (
            <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--muted)]">
              Loading applications...
            </div>
          ) : null}
          {view === "table" ? (
            <ApplicationsTable
              applications={visibleApplications}
              selectedApplicationId={resolvedSelectedApplicationId}
              onSelectApplication={setSelectedApplicationId}
              onClosePreview={() => setSelectedApplicationId(null)}
              onEdit={(application) => setDrawerState({ mode: "edit", application })}
              onPreviewResume={(resume) => setResumePreview(resume)}
            />
          ) : (
            <ApplicationsKanban
              applications={visibleApplications}
              onCreate={(stage) => setDrawerState({ mode: "create", stage })}
              onEdit={(application) => setDrawerState({ mode: "edit", application })}
            />
          )}
        </div>
      </div>

      <ApplicationDrawer
        key={
          drawerState?.mode === "edit"
            ? `edit-${drawerState.application.id}`
            : drawerState?.mode === "create"
              ? `create-${drawerState.stage}`
              : "closed"
        }
        state={drawerState}
        onClose={() => setDrawerState(null)}
        onSave={async (application) => {
          try {
            if (drawerState?.mode === "edit") {
              await updateApplication(application);
            } else {
              await createApplication(application);
            }
            setDrawerState(null);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Failed to save application";
            window.alert(message);
          }
        }}
        onDelete={async (applicationId) => {
          try {
            await deleteApplication(applicationId);
            setDrawerState(null);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Failed to delete application";
            window.alert(message);
          }
        }}
        onUploadResume={uploadResume}
      />
      <ResumePreviewModal
        resume={resumePreview}
        onClose={() => setResumePreview(null)}
      />
    </div>
  );
}
