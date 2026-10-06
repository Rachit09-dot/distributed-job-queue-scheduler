import { JobPayload, JobResult } from './types';

/**
 * Processes a list of numbers and computes statistical aggregates.
 * This is a real CPU computation — no simulation.
 */
export async function processDataProcessing(payload: JobPayload): Promise<JobResult> {
  const numbers = payload.numbers as unknown[];

  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new Error('Payload must contain a non-empty "numbers" array');
  }

  // Validate all entries are numbers
  const validated: number[] = numbers.map((n, i) => {
    const num = Number(n);
    if (isNaN(num)) throw new Error(`Element at index ${i} is not a valid number: ${n}`);
    if (!isFinite(num)) throw new Error(`Element at index ${i} is not a finite number`);
    return num;
  });

  if (validated.length > 100000) {
    throw new Error('Maximum array size is 100,000 elements');
  }

  // Simulate slight I/O latency (like reading from a data source)
  await sleep(50 + Math.floor(Math.random() * 200));

  // Real computation
  const sum = validated.reduce((acc, n) => acc + n, 0);
  const average = sum / validated.length;
  const min = Math.min(...validated);
  const max = Math.max(...validated);
  const count = validated.length;

  // Standard deviation
  const variance = validated.reduce((acc, n) => acc + Math.pow(n - average, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  // Median
  const sorted = [...validated].sort((a, b) => a - b);
  const median =
    count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];

  return {
    success: true,
    message: `Processed ${count} numbers successfully`,
    data: {
      count,
      sum: roundTo(sum, 6),
      average: roundTo(average, 6),
      min,
      max,
      median: roundTo(median, 6),
      stdDev: roundTo(stdDev, 6),
      range: max - min,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
