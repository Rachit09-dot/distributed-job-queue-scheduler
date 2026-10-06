import { JobPayload, JobResult } from './types';
import { createHash } from 'crypto';

/**
 * Simulates image processing using CPU-bound hashing and transformation math.
 * No external files or APIs required — all computation is local.
 *
 * All numeric fields use explicit undefined checks — never || — so that
 * 0 is caught as invalid rather than silently replaced with a default.
 */
export async function processImageProcessingSimulation(payload: JobPayload): Promise<JobResult> {
  // width/height: required, must be positive integer
  const width = payload.width === undefined || payload.width === null
    ? 1920
    : Number(payload.width);
  const height = payload.height === undefined || payload.height === null
    ? 1080
    : Number(payload.height);

  if (!Number.isFinite(width) || width <= 0) {
    throw new Error('Image dimensions must be positive integers');
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error('Image dimensions must be positive integers');
  }
  if (width > 10000 || height > 10000) {
    throw new Error('Image dimensions exceed maximum (10000x10000)');
  }

  const operations = Array.isArray(payload.operations)
    ? (payload.operations as unknown[]).map(String)
    : ['resize', 'grayscale'];

  const validOps = new Set(['resize', 'grayscale', 'blur', 'sharpen', 'rotate', 'compress']);
  for (const op of operations) {
    if (!validOps.has(op)) {
      throw new Error(`Unknown operation: ${op}. Valid: ${[...validOps].join(', ')}`);
    }
  }

  const results: Record<string, unknown> = {};
  let totalMs = 0;

  for (const op of operations) {
    const opStart = Date.now();

    switch (op) {
      case 'resize': {
        const targetWidth = Math.floor(width * 0.5);
        const targetHeight = Math.floor(height * 0.5);
        await doFakePixelWork(targetWidth * targetHeight, 0.1);
        results[op] = { from: `${width}x${height}`, to: `${targetWidth}x${targetHeight}` };
        break;
      }

      case 'grayscale': {
        await doFakePixelWork(width * height, 0.05);
        results[op] = { channels: 1, formula: '0.299R + 0.587G + 0.114B' };
        break;
      }

      case 'blur': {
        // blurRadius: optional, default 5 — but reject 0 or negative
        const radius = payload.blurRadius === undefined || payload.blurRadius === null
          ? 5
          : Number(payload.blurRadius);
        if (!Number.isFinite(radius) || radius <= 0) {
          throw new Error('blurRadius must be a positive number');
        }
        await doFakePixelWork(width * height * radius, 0.08);
        results[op] = { radius, kernel: 'gaussian' };
        break;
      }

      case 'sharpen': {
        await doFakePixelWork(width * height, 0.06);
        results[op] = { kernel: 'unsharp-mask', amount: 1.5 };
        break;
      }

      case 'rotate': {
        // rotateDegrees: optional, default 90 — but 0 would be a no-op, reject it
        const degrees = payload.rotateDegrees === undefined || payload.rotateDegrees === null
          ? 90
          : Number(payload.rotateDegrees);
        if (!Number.isInteger(degrees) || degrees === 0 || degrees % 90 !== 0) {
          throw new Error('Rotation must be a non-zero multiple of 90 degrees');
        }
        await doFakePixelWork(width * height, 0.04);
        results[op] = { degrees };
        break;
      }

      case 'compress': {
        // quality: optional, default 85 — reject 0 (valid range is 1–100)
        const quality = payload.quality === undefined || payload.quality === null
          ? 85
          : Number(payload.quality);
        if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
          throw new Error('Quality must be an integer between 1 and 100');
        }
        await doFakePixelWork(width * height, 0.1);
        const originalBytes = width * height * 3;
        const compressedBytes = Math.floor(originalBytes * (quality / 100) * 0.4);
        results[op] = {
          quality,
          originalSize: formatBytes(originalBytes),
          compressedSize: formatBytes(compressedBytes),
          ratio: `${Math.round((1 - compressedBytes / originalBytes) * 100)}%`,
        };
        break;
      }
    }

    totalMs += Date.now() - opStart;
  }

  const fingerprint = createHash('sha256')
    .update(`${width}x${height}:${operations.join(',')}:${Date.now()}`)
    .digest('hex')
    .slice(0, 16);

  return {
    success: true,
    message: `Image processed with ${operations.length} operation(s)`,
    data: {
      input: { width, height, format: typeof payload.format === 'string' ? payload.format : 'JPEG' },
      operations: results,
      outputFingerprint: fingerprint,
      totalProcessingMs: totalMs,
    },
  };
}

async function doFakePixelWork(pixels: number, factor: number): Promise<void> {
  const ms = Math.min(500, Math.floor((pixels / 1_000_000) * factor * 1000) + 50);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
