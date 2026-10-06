import { JobPayload, JobResult } from './types';

interface ReportSection {
  title: string;
  value: number | string;
}

/**
 * Generates a sample report in-memory.
 * Demonstrates CPU-bound work via data aggregation.
 */
export async function processReportGeneration(payload: JobPayload): Promise<JobResult> {
  const reportType = typeof payload.reportType === 'string' ? payload.reportType : 'general';

  // Use explicit undefined check — never || — so that 0 is rejected, not silently defaulted.
  const month: number =
    payload.month === undefined || payload.month === null
      ? new Date().getMonth() + 1
      : Number(payload.month);

  const year: number =
    payload.year === undefined || payload.year === null
      ? new Date().getFullYear()
      : Number(payload.year);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month: ${payload.month}. Must be an integer between 1 and 12.`);
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid year: ${payload.year}. Must be an integer between 2000 and 2100.`);
  }

  // Simulate report generation time (300–800ms)
  const startCpu = Date.now();
  await sleep(300 + Math.floor(Math.random() * 500));

  // Simulate aggregated data
  const sections: ReportSection[] = [
    { title: 'Total Jobs Processed', value: Math.floor(Math.random() * 10000) + 1000 },
    { title: 'Success Rate (%)', value: (85 + Math.random() * 14).toFixed(2) },
    { title: 'Average Duration (ms)', value: Math.floor(Math.random() * 3000) + 200 },
    { title: 'Peak Concurrency', value: Math.floor(Math.random() * 10) + 2 },
    { title: 'Failed Jobs', value: Math.floor(Math.random() * 100) },
    { title: 'Retried Jobs', value: Math.floor(Math.random() * 50) },
  ];

  const processingTimeMs = Date.now() - startCpu;

  return {
    success: true,
    message: 'Report generated successfully',
    data: {
      reportType,
      period: { month, year, label: `${getMonthName(month)} ${year}` },
      sections,
      generatedAt: new Date().toISOString(),
      processingTimeMs,
      reportId: `rpt_${year}${String(month).padStart(2, '0')}_${Math.random().toString(36).slice(2, 8)}`,
      rowsProcessed: Math.floor(Math.random() * 100000) + 5000,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' });
}
