/**
 * Unit tests for job processor handlers.
 * These run fully in-process with no Redis or PostgreSQL required.
 */

// Use the worker's src path directly
import { processEmailSimulation } from '../../worker/src/jobs/emailSimulation';
import { processDataProcessing } from '../../worker/src/jobs/dataProcessing';
import { processReportGeneration } from '../../worker/src/jobs/reportGeneration';
import { processCustomDelay } from '../../worker/src/jobs/customDelay';
import { processImageProcessingSimulation } from '../../worker/src/jobs/imageProcessingSimulation';
import { getProcessor, getSupportedJobTypes } from '../../worker/src/processors/registry';

// ─── Email Simulation ─────────────────────────────────────────────────────────

describe('processEmailSimulation', () => {
  it('returns success with valid payload', async () => {
    const result = await processEmailSimulation({
      to: 'test@example.com',
      subject: 'Hello',
      body: 'Test body',
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('simulated');
    const data = result.data as Record<string, unknown>;
    expect(data.to).toBe('test@example.com');
    expect(data.messageId).toBeDefined();
  });

  it('throws on missing "to" field', async () => {
    await expect(processEmailSimulation({ subject: 'No recipient' })).rejects.toThrow(
      /"to"/i,
    );
  });

  it('throws on invalid email address', async () => {
    await expect(
      processEmailSimulation({ to: 'not-an-email', subject: 'Test' }),
    ).rejects.toThrow(/invalid email/i);
  });

  it('throws when subject is missing', async () => {
    await expect(processEmailSimulation({ to: 'test@example.com' })).rejects.toThrow();
  });
});

// ─── Data Processing ──────────────────────────────────────────────────────────

describe('processDataProcessing', () => {
  it('computes correct statistics', async () => {
    const result = await processDataProcessing({ numbers: [1, 2, 3, 4, 5] });
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.count).toBe(5);
    expect(data.sum).toBe(15);
    expect(data.average).toBe(3);
    expect(data.min).toBe(1);
    expect(data.max).toBe(5);
    expect(data.median).toBe(3);
  });

  it('computes correctly for a single element', async () => {
    const result = await processDataProcessing({ numbers: [42] });
    const data = result.data as Record<string, unknown>;
    expect(data.count).toBe(1);
    expect(data.sum).toBe(42);
    expect(data.min).toBe(42);
    expect(data.max).toBe(42);
    expect(data.stdDev).toBe(0);
  });

  it('handles negative numbers', async () => {
    const result = await processDataProcessing({ numbers: [-5, -3, -1, 0, 2] });
    const data = result.data as Record<string, unknown>;
    expect(data.sum as number).toBeCloseTo(-7, 4);
    expect(data.min).toBe(-5);
    expect(data.max).toBe(2);
  });

  it('throws on empty array', async () => {
    await expect(processDataProcessing({ numbers: [] })).rejects.toThrow(/non-empty/i);
  });

  it('throws on missing numbers field', async () => {
    await expect(processDataProcessing({})).rejects.toThrow();
  });

  it('throws on non-numeric values', async () => {
    await expect(
      processDataProcessing({ numbers: [1, 2, 'abc', 4] }),
    ).rejects.toThrow(/not a valid number/i);
  });

  it('throws on array exceeding size limit', async () => {
    const huge = Array.from({ length: 100001 }, (_, i) => i);
    await expect(processDataProcessing({ numbers: huge })).rejects.toThrow(/maximum/i);
  });
});

// ─── Report Generation ────────────────────────────────────────────────────────

describe('processReportGeneration', () => {
  it('returns a report with required fields', async () => {
    const result = await processReportGeneration({
      reportType: 'monthly',
      month: 6,
      year: 2026,
    });
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.reportId).toBeDefined();
    const period = data.period as Record<string, unknown>;
    expect(period.month).toBe(6);
    expect(period.year).toBe(2026);
    expect(Array.isArray(data.sections)).toBe(true);
    expect((data.sections as unknown[]).length).toBeGreaterThan(0);
  });

  it('uses current month/year when omitted', async () => {
    const result = await processReportGeneration({ reportType: 'test' });
    expect(result.success).toBe(true);
    const period = (result.data as Record<string, unknown>).period as Record<string, unknown>;
    expect(period.month).toBe(new Date().getMonth() + 1);
    expect(period.year).toBe(new Date().getFullYear());
  });

  it('throws on invalid month (0) — not silently defaulted', async () => {
    await expect(
      processReportGeneration({ reportType: 'test', month: 0, year: 2026 }),
    ).rejects.toThrow(/Invalid month/i);
  });

  it('throws on invalid month (13)', async () => {
    await expect(
      processReportGeneration({ reportType: 'test', month: 13, year: 2026 }),
    ).rejects.toThrow(/Invalid month/i);
  });

  it('throws on negative month', async () => {
    await expect(
      processReportGeneration({ reportType: 'test', month: -1, year: 2026 }),
    ).rejects.toThrow(/Invalid month/i);
  });

  it('throws on non-numeric month string', async () => {
    await expect(
      processReportGeneration({ reportType: 'test', month: 'january', year: 2026 }),
    ).rejects.toThrow(/Invalid month/i);
  });

  it('throws on year too far in the past', async () => {
    await expect(
      processReportGeneration({ reportType: 'test', month: 1, year: 1999 }),
    ).rejects.toThrow(/Invalid year/i);
  });

  it('throws on year too far in the future', async () => {
    await expect(
      processReportGeneration({ reportType: 'test', month: 1, year: 2101 }),
    ).rejects.toThrow(/Invalid year/i);
  });
});

// ─── Custom Delay ─────────────────────────────────────────────────────────────

describe('processCustomDelay', () => {
  beforeAll(() => { jest.setTimeout(10000); });
  afterAll(() => { jest.setTimeout(30000); });

  it('completes with delay=0 quickly', async () => {
    const start = Date.now();
    const result = await processCustomDelay({ delaySeconds: 0 });
    expect(result.success).toBe(true);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('throws when shouldFail=true', async () => {
    await expect(
      processCustomDelay({ delaySeconds: 0, shouldFail: true, failMessage: 'intentional' }),
    ).rejects.toThrow('intentional');
  });

  it('throws on negative delay', async () => {
    await expect(processCustomDelay({ delaySeconds: -1 })).rejects.toThrow(/non-negative/i);
  });

  it('throws when delay exceeds maximum', async () => {
    await expect(processCustomDelay({ delaySeconds: 999 })).rejects.toThrow(/cannot exceed/i);
  });

  it('returns correct data shape', async () => {
    const result = await processCustomDelay({ delaySeconds: 0 });
    const data = result.data as Record<string, unknown>;
    expect(data.requestedDelaySeconds).toBe(0);
    expect(typeof data.actualDurationMs).toBe('number');
    expect(data.completedAt).toBeDefined();
  });
});

// ─── Image Processing Simulation ─────────────────────────────────────────────

describe('processImageProcessingSimulation', () => {
  beforeAll(() => { jest.setTimeout(15000); });
  afterAll(() => { jest.setTimeout(30000); });
  it('processes resize and compress operations', async () => {
    const result = await processImageProcessingSimulation({
      width: 100,
      height: 100,
      operations: ['resize', 'compress'],
      quality: 80,
    });
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const ops = data.operations as Record<string, unknown>;
    expect(ops.resize).toBeDefined();
    expect(ops.compress).toBeDefined();
    expect(data.outputFingerprint).toBeDefined();
  });

  it('throws on invalid dimensions', async () => {
    await expect(
      processImageProcessingSimulation({ width: -1, height: 100, operations: ['resize'] }),
    ).rejects.toThrow(/positive/i);
  });

  it('throws on oversized image', async () => {
    await expect(
      processImageProcessingSimulation({ width: 99999, height: 100, operations: ['resize'] }),
    ).rejects.toThrow(/maximum/i);
  });

  it('throws on unknown operation', async () => {
    await expect(
      processImageProcessingSimulation({
        width: 100,
        height: 100,
        operations: ['unknownOp'],
      }),
    ).rejects.toThrow(/Unknown operation/i);
  });

  it('throws on invalid rotation degree', async () => {
    await expect(
      processImageProcessingSimulation({
        width: 100,
        height: 100,
        operations: ['rotate'],
        rotateDegrees: 45,
      }),
    ).rejects.toThrow(/multiple of 90/i);
  });

  it('throws on rotateDegrees=0 (no-op not allowed)', async () => {
    await expect(
      processImageProcessingSimulation({
        width: 100,
        height: 100,
        operations: ['rotate'],
        rotateDegrees: 0,
      }),
    ).rejects.toThrow(/multiple of 90/i);
  });

  it('throws on quality=0 — not silently defaulted', async () => {
    await expect(
      processImageProcessingSimulation({
        width: 100,
        height: 100,
        operations: ['compress'],
        quality: 0,
      }),
    ).rejects.toThrow(/Quality must be/i);
  });

  it('throws on negative width — not silently defaulted', async () => {
    await expect(
      processImageProcessingSimulation({
        width: 0,
        height: 100,
        operations: ['resize'],
      }),
    ).rejects.toThrow(/positive/i);
  });
});

// ─── Processor Registry ───────────────────────────────────────────────────────

describe('processor registry', () => {
  it('returns all 5 supported job types', () => {
    const types = getSupportedJobTypes();
    expect(types).toHaveLength(5);
    expect(types).toContain('EMAIL_SIMULATION');
    expect(types).toContain('DATA_PROCESSING');
    expect(types).toContain('REPORT_GENERATION');
    expect(types).toContain('IMAGE_PROCESSING_SIMULATION');
    expect(types).toContain('CUSTOM_DELAY');
  });

  it('returns the correct processor function', () => {
    const proc = getProcessor('DATA_PROCESSING');
    expect(typeof proc).toBe('function');
  });

  it('throws for unknown job type', () => {
    expect(() => getProcessor('HACK_THE_PLANET')).toThrow(/Unknown job type/i);
  });
});
