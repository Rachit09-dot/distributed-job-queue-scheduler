import { JobPayload, JobResult } from './types';

/**
 * Simulates sending an email.
 * In production this would integrate with an email provider (SendGrid, SES, etc.).
 * Here we validate the payload and simulate the network latency.
 */
export async function processEmailSimulation(payload: JobPayload): Promise<JobResult> {
  const to = payload.to as string | undefined;
  const subject = payload.subject as string | undefined;
  const body = payload.body as string | undefined;

  if (!to || !subject) {
    throw new Error('Email simulation requires "to" and "subject" fields in payload');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error(`Invalid email address: ${to}`);
  }

  // Simulate SMTP latency (200–600ms)
  const delay = 200 + Math.floor(Math.random() * 400);
  await sleep(delay);

  return {
    success: true,
    message: 'Email sent successfully (simulated)',
    data: {
      to,
      subject,
      bodyLength: body?.length ?? 0,
      simulatedSmtpDelayMs: delay,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
