import { describe, it, expect } from 'vitest';
import { formatDuration, formatJobType, STATUS_CONFIG, PRIORITY_CONFIG } from '../utils/formatting';

describe('formatDuration', () => {
  it('returns — for null', () => {
    expect(formatDuration(null)).toBe('—');
  });

  it('formats milliseconds under 1 second', () => {
    expect(formatDuration(850)).toBe('850ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
  });

  it('formats exactly 1 minute', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
  });
});

describe('formatJobType', () => {
  it('formats EMAIL_SIMULATION correctly', () => {
    expect(formatJobType('EMAIL_SIMULATION')).toBe('Email Simulation');
  });

  it('formats DATA_PROCESSING correctly', () => {
    expect(formatJobType('DATA_PROCESSING')).toBe('Data Processing');
  });

  it('formats CUSTOM_DELAY correctly', () => {
    expect(formatJobType('CUSTOM_DELAY')).toBe('Custom Delay');
  });

  it('formats REPORT_GENERATION correctly', () => {
    expect(formatJobType('REPORT_GENERATION')).toBe('Report Generation');
  });
});

describe('STATUS_CONFIG', () => {
  it('has entries for all 7 statuses', () => {
    const statuses = ['CREATED','QUEUED','SCHEDULED','RUNNING','COMPLETED','FAILED','CANCELLED'];
    for (const s of statuses) {
      expect(STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]).toBeDefined();
      expect(STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label).toBeTruthy();
    }
  });
});

describe('PRIORITY_CONFIG', () => {
  it('has entries for all 4 priorities', () => {
    const priorities = ['CRITICAL','HIGH','NORMAL','LOW'];
    for (const p of priorities) {
      expect(PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG]).toBeDefined();
    }
  });
});
