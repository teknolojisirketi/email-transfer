import { clearToken, getToken } from './auth'

export interface AccountTestResult {
  success: boolean
  message: string
  folder_count: number
  inbox_messages: number
}

export interface AccountTestResponse {
  yandex: AccountTestResult
  cpanel: AccountTestResult
  overall_success: boolean
}

export interface Settings {
  yandex_imap_host: string
  yandex_imap_port: number
  yandex_imap_ssl: boolean
  cpanel_imap_port: number
  cpanel_imap_ssl: boolean
  worker_concurrency: number
}

export interface Account {
  id: number
  yandex_email: string
  cpanel_email: string
  cpanel_imap_host: string
  created_at: string
  latest_job_uuid: string | null
  latest_job_status: string | null
  messages_transferred: number
  latest_job_error: string | null
}

export interface AccountCreate {
  yandex_email: string
  yandex_password: string
  cpanel_email: string
  cpanel_password: string
  cpanel_imap_host: string
}

export interface FolderProgress {
  name: string
  index: number
  total: number
  source_messages: number | null
  transferred: number | null
  status: string
}

export interface JobLog {
  job_uuid: string
  log: string
  folders: FolderProgress[]
  messages_transferred: number
}

export interface Job {
  uuid: string
  account_id: number
  status: string
  messages_transferred: number
  error_message: string | null
  log_file: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  yandex_email: string | null
  cpanel_email: string | null
  migrate_years: string | null
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface UserResponse {
  username: string
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, {
    headers,
    ...options,
  })
  if (res.status === 401) {
    clearToken()
    const err = await res.json().catch(() => ({ detail: 'Session expired' }))
    throw new AuthError(err.detail || 'Sign in required')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<UserResponse>('/auth/me'),

  getSettings: () => request<Settings>('/settings'),
  updateSettings: (data: Partial<Settings>) =>
    request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  getAccounts: () => request<Account[]>('/accounts'),
  createAccount: (data: AccountCreate) =>
    request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  bulkImport: (accounts: AccountCreate[], replaceExisting = false) =>
    request<{ imported: number; skipped: number }>('/accounts/bulk', {
      method: 'POST',
      body: JSON.stringify({ accounts, replace_existing: replaceExisting }),
    }),
  updateAccount: (id: number, data: Partial<AccountCreate>) =>
    request<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id: number) => request<void>(`/accounts/${id}`, { method: 'DELETE' }),
  deleteAllAccounts: () => request<void>('/accounts', { method: 'DELETE' }),
  testAccount: (data: AccountCreate) =>
    request<AccountTestResponse>('/accounts/test', { method: 'POST', body: JSON.stringify(data) }),
  testSavedAccount: (id: number) =>
    request<AccountTestResponse>(`/accounts/${id}/test`, { method: 'POST' }),

  getJobs: () => request<Job[]>('/jobs'),
  startMigration: (accountIds?: number[], years?: number[]) =>
    request<{ jobs_created: number; job_uuids: string[] }>('/jobs/start', {
      method: 'POST',
      body: JSON.stringify({
        account_ids: accountIds ?? null,
        years: years && years.length > 0 ? years : null,
      }),
    }),
  retryJob: (uuid: string) => request<Job>(`/jobs/${uuid}/retry`, { method: 'POST' }),
  cancelJob: (uuid: string) => request<Job>(`/jobs/${uuid}/cancel`, { method: 'POST' }),
  deleteJob: (uuid: string) => request<void>(`/jobs/${uuid}`, { method: 'DELETE' }),
  getJobLog: (uuid: string) => request<JobLog>(`/jobs/${uuid}/log`),
}
