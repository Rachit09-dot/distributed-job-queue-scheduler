import { z } from 'zod';

export const JobTypeEnum = z.enum([
  'EMAIL_SIMULATION',
  'REPORT_GENERATION',
  'DATA_PROCESSING',
  'IMAGE_PROCESSING_SIMULATION',
  'CUSTOM_DELAY',
]);

export const JobPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);

// ── Per-job-type payload schemas ──────────────────────────────────────────────
// Validated at API ingestion time — invalid payloads are rejected before the job
// enters the queue. This prevents retrying a job that can never succeed.

const EmailSimulationPayloadSchema = z.object({
  to: z.string().email('to must be a valid email address'),
  subject: z.string().min(1, 'subject is required'),
  body: z.string().optional(),
});

const ReportGenerationPayloadSchema = z.object({
  reportType: z.string().default('general'),
  // month/year are optional (default to current); when provided they must be valid integers
  month: z
    .number()
    .int()
    .min(1, 'month must be 1–12')
    .max(12, 'month must be 1–12')
    .optional(),
  year: z
    .number()
    .int()
    .min(2000, 'year must be ≥ 2000')
    .max(2100, 'year must be ≤ 2100')
    .optional(),
});

const DataProcessingPayloadSchema = z.object({
  numbers: z
    .array(z.number({ invalid_type_error: 'every element in numbers must be a number' }))
    .min(1, 'numbers array must not be empty')
    .max(100000, 'numbers array must not exceed 100,000 elements'),
});

const ImageProcessingOperationEnum = z.enum([
  'resize',
  'grayscale',
  'blur',
  'sharpen',
  'rotate',
  'compress',
]);

const ImageProcessingSimulationPayloadSchema = z.object({
  width: z.number().int().positive('width must be a positive integer').max(10000).optional(),
  height: z.number().int().positive('height must be a positive integer').max(10000).optional(),
  operations: z
    .array(ImageProcessingOperationEnum)
    .min(1, 'at least one operation is required')
    .default(['resize']),
  // operation-specific optional fields
  blurRadius: z.number().positive('blurRadius must be positive').optional(),
  rotateDegrees: z
    .number()
    .int()
    .refine((v) => v !== 0 && v % 90 === 0, {
      message: 'rotateDegrees must be a non-zero multiple of 90',
    })
    .optional(),
  quality: z
    .number()
    .int()
    .min(1, 'quality must be 1–100')
    .max(100, 'quality must be 1–100')
    .optional(),
  format: z.string().optional(),
});

const CustomDelayPayloadSchema = z.object({
  delaySeconds: z
    .number()
    .min(0, 'delaySeconds must be non-negative')
    .max(60, 'delaySeconds cannot exceed 60')
    .default(2),
  shouldFail: z.boolean().default(false),
  failMessage: z.string().optional(),
});

// Maps each job type to its Zod payload schema
const PAYLOAD_SCHEMAS: Record<z.infer<typeof JobTypeEnum>, z.ZodTypeAny> = {
  EMAIL_SIMULATION: EmailSimulationPayloadSchema,
  REPORT_GENERATION: ReportGenerationPayloadSchema,
  DATA_PROCESSING: DataProcessingPayloadSchema,
  IMAGE_PROCESSING_SIMULATION: ImageProcessingSimulationPayloadSchema,
  CUSTOM_DELAY: CustomDelayPayloadSchema,
};

/**
 * Validate a job payload against the schema for its type.
 * Throws ZodError (caught by the Express error handler → 400) on failure.
 */
export function validateJobPayload(
  type: z.infer<typeof JobTypeEnum>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const schema = PAYLOAD_SCHEMAS[type];
  return schema.parse(payload) as Record<string, unknown>;
}

// ── Top-level job creation schema ─────────────────────────────────────────────

export const CreateJobSchema = z.object({
  type: JobTypeEnum,
  // Accept a generic payload object at this level; per-type validation happens
  // via validateJobPayload() in the service layer, after type is known.
  payload: z.record(z.unknown()).default({}),
  priority: JobPriorityEnum.default('NORMAL'),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  scheduledAt: z
    .string()
    .datetime({ message: 'scheduledAt must be a valid ISO 8601 datetime' })
    .optional()
    .refine(
      (val) => !val || new Date(val) > new Date(),
      { message: 'scheduledAt must be in the future' },
    ),
  idempotencyKey: z.string().max(128).optional(),
});

export const UpdateJobSchema = z.object({
  priority: JobPriorityEnum.optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
});

export const ScheduleJobSchema = z.object({
  scheduledAt: z
    .string()
    .datetime({ message: 'scheduledAt must be a valid ISO 8601 datetime' })
    .refine(
      (val) => new Date(val) > new Date(),
      { message: 'scheduledAt must be in the future' },
    ),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
export type ScheduleJobInput = z.infer<typeof ScheduleJobSchema>;
