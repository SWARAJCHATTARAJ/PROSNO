export type IndexStatus = "PENDING" | "INDEXING" | "READY" | "FAILED" | "EXPIRED";

export type User = {
  id: string;
  githubId: number;
  githubUsername: string;
  displayName: string;
  avatarUrl: string | null;
};

export type Repository = {
  id: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  htmlUrl: string | null;
  description: string | null;
  indexStatus: IndexStatus;
  indexedAt: string | null;
  chunkCount: number;
  filesTotal: number;
  filesProcessed: number;
  errorMessage: string | null;
};

export type IndexStatusResponse = {
  repositoryId: string;
  indexStatus: IndexStatus;
  filesTotal: number;
  filesProcessed: number;
  chunkCount: number;
  indexedAt: string | null;
  errorMessage: string | null;
};

export type IndexOutcome = "STARTED_INDEXING" | "ALREADY_UP_TO_DATE" | "ALREADY_IN_PROGRESS" | "ATTACHED_EXISTING";

export type IndexTriggerResponse = {
  repository: Repository;
  outcome: IndexOutcome;
};

export type ChatSession = {
  id: string;
  repositoryId: string;
  title: string;
  createdAt: string;
};

export type Citation = {
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  language: string | null;
};

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations: Citation[];
  createdAt: string;
};


export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (
    process.env.NODE_ENV === "production" ||
    (typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1")
  ) {
    return "https://api.prosno.swarajchattaraj.tech";
  }
  return "http://localhost:8080";
}

export function getGithubLoginUrl() {
  return `${getApiBaseUrl()}/oauth2/authorization/github`;
}

async function parseError(res: Response): Promise<{message: string, retryAfter?: number}> {
  let message = res.statusText || "Request failed";
  try {
    const data = await res.json();
    message = data.message ?? data.error ?? res.statusText;
  } catch {}
  
  let retryAfter = undefined;
  if (res.headers.has("Retry-After")) {
    retryAfter = parseInt(res.headers.get("Retry-After")!, 10);
  }
  return { message, retryAfter };
}

export type GithubRepo = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  isPrivate: boolean;
  htmlUrl: string | null;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  connected: boolean;
  connectedRepoId: string | null;
  indexStatus: IndexStatus | null;
};

export type ConnectRepoRequest = {
  githubRepoId?: number;
  fullName?: string;
};

export type ConnectBatchRequest = {
  repositories: ConnectRepoRequest[];
};

export type ConnectBatchItemResult = {
  githubRepoId?: number;
  fullName?: string;
  success: boolean;
  repository?: Repository;
  outcome?: IndexOutcome;
  error?: string;
};

export type ConnectBatchResponse = {
  results: ConnectBatchItemResult[];
};

let inMemoryCsrfToken = "";

export function setCsrfToken(token: string) {
  if (token) {
    inMemoryCsrfToken = token;
  }
}

export function getCsrfToken() {
  if (inMemoryCsrfToken) return inMemoryCsrfToken;
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

let csrfPromise: Promise<string> | null = null;

export async function ensureCsrfToken(): Promise<string> {
  const current = getCsrfToken();
  if (current) return current;
  if (csrfPromise) return csrfPromise;

  csrfPromise = (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/csrf`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setCsrfToken(data.token);
          return data.token;
        }
      }
    } catch {
      // ignore
    } finally {
      csrfPromise = null;
    }
    return getCsrfToken();
  })();

  return csrfPromise;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (isMutating && !getCsrfToken()) {
    await ensureCsrfToken();
  }

  const csrfToken = getCsrfToken();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const csrfFromHeader = res.headers.get("X-CSRF-TOKEN");
  if (csrfFromHeader) {
    setCsrfToken(csrfFromHeader);
  }

  if (!res.ok) {
    const parsed = await parseError(res);
    throw new ApiError(res.status, parsed.message, parsed.retryAfter);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  csrf: () => apiFetch<{ token: string; headerName: string }>("/api/auth/csrf"),
  me: () => apiFetch<User>("/api/auth/me"),
  logout: async () => {
    await ensureCsrfToken();
    try {
      await apiFetch<void>("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      inMemoryCsrfToken = "";
    }
  },

  listRepos: (refresh = false) =>
    apiFetch<Repository[]>(`/api/repos?refresh=${refresh}`),
  getRepo: (id: string) => apiFetch<Repository>(`/api/repos/${id}`),
  listGithubRepos: () => apiFetch<GithubRepo[]>("/api/repos/github"),
  connectRepo: (req: ConnectRepoRequest) =>
    apiFetch<IndexTriggerResponse>("/api/repos/connect", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  connectBatch: (req: ConnectBatchRequest) =>
    apiFetch<ConnectBatchResponse>("/api/repos/connect/batch", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  disconnectRepo: (id: string) =>
    apiFetch<void>(`/api/repos/${id}`, {
      method: "DELETE",
    }),
  addPublicRepo: (input: string) =>
    apiFetch<IndexTriggerResponse>("/api/repos/add-public", {
      method: "POST",
      body: JSON.stringify({ input }),
    }),
  startIndex: (id: string) =>
    apiFetch<IndexTriggerResponse>(`/api/repos/${id}/index`, { method: "POST" }),
  refreshIndex: (id: string) =>
    apiFetch<IndexTriggerResponse>(`/api/repos/${id}/refresh`, { method: "POST" }),
  indexStatus: (id: string) =>
    apiFetch<IndexStatusResponse>(`/api/repos/${id}/status`),
  createSession: (repositoryId: string, title?: string) =>
    apiFetch<ChatSession>("/api/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ repositoryId, title }),
    }),
  listSessions: (repositoryId: string) =>
    apiFetch<ChatSession[]>(
      `/api/chat/sessions?repositoryId=${encodeURIComponent(repositoryId)}`
    ),
  getMessages: (sessionId: string) =>
    apiFetch<ChatMessage[]>(`/api/chat/sessions/${sessionId}`),
};