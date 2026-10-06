/**
 * Unit tests for Zod validators.
 * No DB / Redis / network required.
 */

import { RegisterSchema, LoginSchema } from '../../server/src/validators/auth.validator';
import { CreateJobSchema } from '../../server/src/validators/job.validator';

// ─── Auth validators ──────────────────────────────────────────────────────────

describe('RegisterSchema', () => {
  const valid = { name: 'Jane Smith', email: 'jane@example.com', password: 'secret123' };

  it('accepts a valid registration payload', () => {
    expect(() => RegisterSchema.parse(valid)).not.toThrow();
  });

  it('rejects email without @ symbol', () => {
    expect(() => RegisterSchema.parse({ ...valid, email: 'notanemail' })).toThrow();
  });

  it('rejects name shorter than 2 characters', () => {
    expect(() => RegisterSchema.parse({ ...valid, name: 'A' })).toThrow();
  });

  it('rejects password shorter than 8 characters', () => {
    expect(() => RegisterSchema.parse({ ...valid, password: 'short' })).toThrow();
  });

  it('rejects password longer than 72 characters', () => {
    expect(() => RegisterSchema.parse({ ...valid, password: 'a'.repeat(73) })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => RegisterSchema.parse({ email: 'test@test.com' })).toThrow();
  });
});

describe('LoginSchema', () => {
  const valid = { email: 'user@example.com', password: 'mypassword' };

  it('accepts valid credentials', () => {
    expect(() => LoginSchema.parse(valid)).not.toThrow();
  });

  it('rejects empty password', () => {
    expect(() => LoginSchema.parse({ ...valid, password: '' })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => LoginSchema.parse({ ...valid, email: 'bad' })).toThrow();
  });
});

// ─── Job creation validator ───────────────────────────────────────────────────

describe('CreateJobSchema', () => {
  const valid = {
    type: 'DATA_PROCESSING',
    payload: { numbers: [1, 2, 3] },
    priority: 'NORMAL',
    maxAttempts: 3,
  };

  it('accepts a valid job payload', () => {
    const result = CreateJobSchema.parse(valid);
    expect(result.type).toBe('DATA_PROCESSING');
    expect(result.priority).toBe('NORMAL');
    expect(result.maxAttempts).toBe(3);
  });

  it('applies default priority of NORMAL when omitted', () => {
    const result = CreateJobSchema.parse({ type: 'CUSTOM_DELAY', payload: {} });
    expect(result.priority).toBe('NORMAL');
  });

  it('applies default maxAttempts of 3 when omitted', () => {
    const result = CreateJobSchema.parse({ type: 'CUSTOM_DELAY' });
    expect(result.maxAttempts).toBe(3);
  });

  it('rejects unknown job type', () => {
    expect(() =>
      CreateJobSchema.parse({ ...valid, type: 'HACK_THE_PLANET' }),
    ).toThrow();
  });

  it('rejects unknown priority', () => {
    expect(() =>
      CreateJobSchema.parse({ ...valid, priority: 'ULTRA' }),
    ).toThrow();
  });

  it('rejects maxAttempts = 0', () => {
    expect(() =>
      CreateJobSchema.parse({ ...valid, maxAttempts: 0 }),
    ).toThrow();
  });

  it('rejects maxAttempts > 10', () => {
    expect(() =>
      CreateJobSchema.parse({ ...valid, maxAttempts: 11 }),
    ).toThrow();
  });

  it('rejects scheduledAt in the past', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString();
    expect(() =>
      CreateJobSchema.parse({ ...valid, scheduledAt: pastDate }),
    ).toThrow(/future/i);
  });

  it('accepts scheduledAt in the future', () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    expect(() =>
      CreateJobSchema.parse({ ...valid, scheduledAt: futureDate }),
    ).not.toThrow();
  });

  it('rejects non-ISO scheduledAt string', () => {
    expect(() =>
      CreateJobSchema.parse({ ...valid, scheduledAt: 'next tuesday' }),
    ).toThrow();
  });

  it('rejects idempotencyKey longer than 128 chars', () => {
    expect(() =>
      CreateJobSchema.parse({ ...valid, idempotencyKey: 'x'.repeat(129) }),
    ).toThrow();
  });

  it('accepts all valid job types', () => {
    const types = [
      'EMAIL_SIMULATION',
      'REPORT_GENERATION',
      'DATA_PROCESSING',
      'IMAGE_PROCESSING_SIMULATION',
      'CUSTOM_DELAY',
    ];
    for (const type of types) {
      expect(() => CreateJobSchema.parse({ ...valid, type })).not.toThrow();
    }
  });
});

// ─── Email normalization behaviour ───────────────────────────────────────────
// These test the auth service normalisation logic directly (no DB needed).

describe('email normalization', () => {
  it('Zod accepts mixed-case email (normalization is done in service layer)', () => {
    // RegisterSchema accepts A@X.COM — the service then lowercases it
    expect(() => RegisterSchema.parse({ name: 'Test', email: 'A@X.COM', password: 'password1' }))
      .not.toThrow();
  });

  it('Zod trims surrounding whitespace from email', () => {
    // Zod .email() rejects strings with leading/trailing spaces,
    // so we rely on the service to call .trim() before parsing
    // (or the client to send a trimmed value).
    // Verify schema rejects untrimmed input so we know trimming must happen upstream.
    expect(() => RegisterSchema.parse({ name: 'Test', email: '  a@x.com  ', password: 'password1' }))
      .toThrow(); // Zod email validator rejects whitespace-padded strings
  });
});

// ─── Per-job-type payload validation ─────────────────────────────────────────

import { validateJobPayload } from '../../server/src/validators/job.validator';

describe('validateJobPayload — EMAIL_SIMULATION', () => {
  it('accepts valid email payload', () => {
    expect(() =>
      validateJobPayload('EMAIL_SIMULATION', { to: 'a@b.com', subject: 'Hi' }),
    ).not.toThrow();
  });
  it('rejects missing to', () => {
    expect(() =>
      validateJobPayload('EMAIL_SIMULATION', { subject: 'Hi' }),
    ).toThrow();
  });
  it('rejects invalid email in to', () => {
    expect(() =>
      validateJobPayload('EMAIL_SIMULATION', { to: 'notanemail', subject: 'Hi' }),
    ).toThrow(/email/i);
  });
  it('rejects missing subject', () => {
    expect(() =>
      validateJobPayload('EMAIL_SIMULATION', { to: 'a@b.com' }),
    ).toThrow();
  });
});

describe('validateJobPayload — REPORT_GENERATION', () => {
  it('accepts valid payload with month and year', () => {
    expect(() =>
      validateJobPayload('REPORT_GENERATION', { month: 6, year: 2026 }),
    ).not.toThrow();
  });
  it('accepts empty payload (uses defaults)', () => {
    expect(() => validateJobPayload('REPORT_GENERATION', {})).not.toThrow();
  });
  it('rejects month=0', () => {
    expect(() =>
      validateJobPayload('REPORT_GENERATION', { month: 0, year: 2026 }),
    ).toThrow();
  });
  it('rejects month=13', () => {
    expect(() =>
      validateJobPayload('REPORT_GENERATION', { month: 13, year: 2026 }),
    ).toThrow();
  });
  it('rejects year=1999', () => {
    expect(() =>
      validateJobPayload('REPORT_GENERATION', { month: 1, year: 1999 }),
    ).toThrow();
  });
});

describe('validateJobPayload — DATA_PROCESSING', () => {
  it('accepts valid numbers array', () => {
    expect(() =>
      validateJobPayload('DATA_PROCESSING', { numbers: [1, 2, 3] }),
    ).not.toThrow();
  });
  it('rejects empty array', () => {
    expect(() =>
      validateJobPayload('DATA_PROCESSING', { numbers: [] }),
    ).toThrow();
  });
  it('rejects non-number elements', () => {
    expect(() =>
      validateJobPayload('DATA_PROCESSING', { numbers: [1, 'abc', 3] }),
    ).toThrow();
  });
  it('rejects missing numbers field', () => {
    expect(() => validateJobPayload('DATA_PROCESSING', {})).toThrow();
  });
});

describe('validateJobPayload — IMAGE_PROCESSING_SIMULATION', () => {
  it('accepts valid payload', () => {
    expect(() =>
      validateJobPayload('IMAGE_PROCESSING_SIMULATION', {
        width: 1920,
        height: 1080,
        operations: ['resize'],
      }),
    ).not.toThrow();
  });
  it('rejects quality=0', () => {
    expect(() =>
      validateJobPayload('IMAGE_PROCESSING_SIMULATION', {
        operations: ['compress'],
        quality: 0,
      }),
    ).toThrow();
  });
  it('rejects unknown operation', () => {
    expect(() =>
      validateJobPayload('IMAGE_PROCESSING_SIMULATION', {
        operations: ['explode'],
      }),
    ).toThrow();
  });
  it('rejects rotateDegrees=45', () => {
    expect(() =>
      validateJobPayload('IMAGE_PROCESSING_SIMULATION', {
        operations: ['rotate'],
        rotateDegrees: 45,
      }),
    ).toThrow(/multiple of 90/i);
  });
});

describe('validateJobPayload — CUSTOM_DELAY', () => {
  it('accepts valid payload', () => {
    expect(() =>
      validateJobPayload('CUSTOM_DELAY', { delaySeconds: 5 }),
    ).not.toThrow();
  });
  it('accepts empty payload (uses defaults)', () => {
    expect(() => validateJobPayload('CUSTOM_DELAY', {})).not.toThrow();
  });
  it('rejects delaySeconds > 60', () => {
    expect(() =>
      validateJobPayload('CUSTOM_DELAY', { delaySeconds: 61 }),
    ).toThrow();
  });
  it('rejects negative delaySeconds', () => {
    expect(() =>
      validateJobPayload('CUSTOM_DELAY', { delaySeconds: -1 }),
    ).toThrow();
  });
});
