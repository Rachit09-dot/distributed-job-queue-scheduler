import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJob } from '../services/job.service';
import { getErrorMessage } from '../services/api';
import { JobType, JobPriority } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { formatJobType } from '../utils/formatting';

type PayloadKey = string;

const JOB_TYPE_DEFAULTS: Record<JobType, Record<PayloadKey, unknown>> = {
  EMAIL_SIMULATION: { to: 'recipient@example.com', subject: 'Test Email', body: 'Hello from JobQueue!' },
  REPORT_GENERATION: { reportType: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() },
  DATA_PROCESSING: { numbers: [1, 2, 3, 4, 5, 10, 20, 50, 100] },
  IMAGE_PROCESSING_SIMULATION: { width: 1920, height: 1080, operations: ['resize', 'compress'], quality: 85 },
  CUSTOM_DELAY: { delaySeconds: 3, shouldFail: false },
};

const JOB_TYPE_DESCRIPTIONS: Record<JobType, string> = {
  EMAIL_SIMULATION: 'Simulates sending an email with validation and SMTP delay',
  REPORT_GENERATION: 'Generates a data report with aggregated statistics',
  DATA_PROCESSING: 'Computes sum, average, min, max, median on a number array',
  IMAGE_PROCESSING_SIMULATION: 'Simulates image transformations (resize, compress, blur, etc.)',
  CUSTOM_DELAY: 'Waits for N seconds — useful for testing retries and concurrency',
};

const TYPE_OPTIONS: JobType[] = [
  'EMAIL_SIMULATION',
  'REPORT_GENERATION',
  'DATA_PROCESSING',
  'IMAGE_PROCESSING_SIMULATION',
  'CUSTOM_DELAY',
];

const PRIORITY_OPTIONS: JobPriority[] = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'];

export function CreateJobPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<JobType>('DATA_PROCESSING');
  const [priority, setPriority] = useState<JobPriority>('NORMAL');
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(JOB_TYPE_DEFAULTS['DATA_PROCESSING'], null, 2),
  );
  const [payloadError, setPayloadError] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleTypeChange(newType: JobType) {
    setType(newType);
    setPayloadText(JSON.stringify(JOB_TYPE_DEFAULTS[newType], null, 2));
    setPayloadError('');
  }

  function validatePayload(): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setPayloadError('Payload must be a JSON object {}');
        return null;
      }
      setPayloadError('');
      return parsed as Record<string, unknown>;
    } catch {
      setPayloadError('Invalid JSON — please check your payload');
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = validatePayload();
    if (!payload) return;

    if (scheduleMode === 'later' && !scheduledAt) {
      setError('Please choose a scheduled time');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const job = await createJob({
        type,
        payload,
        priority,
        maxAttempts,
        ...(scheduleMode === 'later' && scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
      });
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const minScheduleTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Job</h1>
        <p className="text-gray-500 text-sm mt-1">Configure and dispatch a background job</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job type */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Job Type</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`text-left p-3 rounded-lg border-2 transition-all ${
                  type === t
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-medium text-gray-800">{formatJobType(t)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{JOB_TYPE_DESCRIPTIONS[t]}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Priority + Attempts */}
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as JobPriority)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(parseInt(e.target.value, 10))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>

        {/* Payload */}
        <Card>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Payload (JSON)
          </label>
          <textarea
            value={payloadText}
            onChange={(e) => { setPayloadText(e.target.value); setPayloadError(''); }}
            rows={8}
            spellCheck={false}
            className={`w-full font-mono text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              payloadError ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {payloadError && <p className="mt-1 text-xs text-red-600">{payloadError}</p>}
        </Card>

        {/* Scheduling */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Execution</h2>
          <div className="flex gap-3 mb-4">
            {(['now', 'later'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScheduleMode(mode)}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  scheduleMode === mode
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {mode === 'now' ? '▶ Run Immediately' : '📅 Schedule for Later'}
              </button>
            ))}
          </div>
          {scheduleMode === 'later' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={minScheduleTime}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/jobs')}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            {scheduleMode === 'now' ? 'Create & Queue Job' : 'Create & Schedule Job'}
          </Button>
        </div>
      </form>
    </div>
  );
}
