export interface JobPayload {
  [key: string]: unknown;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  message: string;
  durationMs?: number;
}

export type JobProcessor = (payload: JobPayload) => Promise<JobResult>;
