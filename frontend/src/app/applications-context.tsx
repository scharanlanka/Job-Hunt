"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

export const STAGES = [
  "Applied",
  "Applied with Referral",
  "Interview Scheduled",
  "Interviewed",
  "Followed Up",
  "Offered",
  "Rejected",
] as const;

export type Stage = (typeof STAGES)[number];

export type InterviewRound = {
  id?: number;
  roundNumber: number;
  roundType?: string;
  scheduledAt?: string;
  completedAt?: string;
  result?: "Pending" | "Pass" | "Fail" | "Cancelled";
  notes?: string;
};

export type Application = {
  id: string;
  company: string;
  role: string;
  location?: string;
  stage: Stage;
  appliedDate: string;
  jobUrl?: string;
  appliedOn?: "LinkedIn" | "Indeed" | "Glassdoor" | "Company Portal";
  referralDetails?: string;
  interviewRounds: InterviewRound[];
  jobDescription: string;
  notes: string;
  resumeUsed?: {
    name: string;
    url?: string;
  };
};

type State = {
  applications: Application[];
};

type Action =
  | { type: "set"; payload: Application[] }
  | { type: "create"; payload: Application }
  | { type: "update"; payload: Application }
  | { type: "delete"; payload: { id: string } };

type ContextValue = State & {
  loading: boolean;
  error: string | null;
  refreshApplications: () => Promise<void>;
  createApplication: (payload: Application) => Promise<void>;
  updateApplication: (payload: Application) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  uploadResume: (file: File) => Promise<{ name: string; url: string; key: string }>;
};

const ApplicationsContext = createContext<ContextValue | undefined>(undefined);

const PRIMARY_API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api"
).replace(/\/+$/, "");

function normalizeApplication(application: Application): Application {
  const rounds = Array.isArray(application.interviewRounds)
    ? application.interviewRounds
    : [];
  return {
    ...application,
    interviewRounds: rounds,
  };
}

function normalizeApplications(applications: Application[]): Application[] {
  return applications.map(normalizeApplication);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set":
      return { applications: normalizeApplications(action.payload) };
    case "create":
      return {
        applications: [normalizeApplication(action.payload), ...state.applications],
      };
    case "update":
      return {
        applications: state.applications.map((application) =>
          application.id === action.payload.id
            ? normalizeApplication(action.payload)
            : application
        ),
      };
    case "delete":
      return {
        applications: state.applications.filter(
          (application) => application.id !== action.payload.id
        ),
      };
    default:
      return state;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasFormDataBody =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  let response: Response | null = null;
  const baseCandidates = [PRIMARY_API_BASE_URL];

  try {
    response = await fetch(`${PRIMARY_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body && !hasFormDataBody ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    response = null;
  }

  if (!response) {
    const joinedBases = baseCandidates.join(" or ");
    throw new Error(
      `Cannot reach backend at ${joinedBases}. Make sure FastAPI is running and CORS allows your frontend origin.`
    );
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body?.detail) {
        detail = body.detail;
      }
    } catch {
      // Keep fallback error detail.
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function serializeApplication(payload: Application): Application {
  return {
    ...payload,
    interviewRounds: (payload.interviewRounds ?? []).map((round) => ({
      roundNumber: round.roundNumber,
      roundType: round.roundType,
      scheduledAt: round.scheduledAt,
      completedAt: round.completedAt,
      result: round.result,
      notes: round.notes,
    })),
  };
}

export function ApplicationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, { applications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<Application[]>("/applications");
      dispatch({ type: "set", payload: normalizeApplications(data) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load applications";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshApplications();
  }, []);

  const value = useMemo(
    () => ({
      applications: state.applications,
      loading,
      error,
      refreshApplications,
      createApplication: async (payload: Application) => {
        const created = await request<Application>("/applications", {
          method: "POST",
          body: JSON.stringify(serializeApplication(payload)),
        });
        dispatch({ type: "create", payload: created });
      },
      updateApplication: async (payload: Application) => {
        const updated = await request<Application>(`/applications/${payload.id}`, {
          method: "PUT",
          body: JSON.stringify(serializeApplication(payload)),
        });
        dispatch({ type: "update", payload: updated });
      },
      deleteApplication: async (id: string) => {
        await request<void>(`/applications/${id}`, { method: "DELETE" });
        dispatch({ type: "delete", payload: { id } });
      },
      uploadResume: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return request<{ name: string; url: string; key: string }>("/uploads/resume", {
          method: "POST",
          body: formData,
        });
      },
    }),
    [state.applications, loading, error]
  );

  return (
    <ApplicationsContext.Provider value={value}>
      {children}
    </ApplicationsContext.Provider>
  );
}

export function useApplications() {
  const value = useContext(ApplicationsContext);
  if (!value) {
    throw new Error("useApplications must be used within ApplicationsProvider");
  }
  return value;
}
