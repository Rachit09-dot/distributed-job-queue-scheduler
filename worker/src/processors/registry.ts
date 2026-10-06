import { JobProcessor } from '../jobs/types';
import { processEmailSimulation } from '../jobs/emailSimulation';
import { processReportGeneration } from '../jobs/reportGeneration';
import { processDataProcessing } from '../jobs/dataProcessing';
import { processImageProcessingSimulation } from '../jobs/imageProcessingSimulation';
import { processCustomDelay } from '../jobs/customDelay';

/**
 * Maps job type strings to their handler functions.
 * Only predefined, safe handlers are registered here.
 * User-submitted payloads NEVER execute arbitrary code.
 */
const PROCESSOR_REGISTRY: Record<string, JobProcessor> = {
  EMAIL_SIMULATION: processEmailSimulation,
  REPORT_GENERATION: processReportGeneration,
  DATA_PROCESSING: processDataProcessing,
  IMAGE_PROCESSING_SIMULATION: processImageProcessingSimulation,
  CUSTOM_DELAY: processCustomDelay,
};

export function getProcessor(jobType: string): JobProcessor {
  const processor = PROCESSOR_REGISTRY[jobType];
  if (!processor) {
    throw new Error(
      `Unknown job type: "${jobType}". Valid types: ${Object.keys(PROCESSOR_REGISTRY).join(', ')}`,
    );
  }
  return processor;
}

export function getSupportedJobTypes(): string[] {
  return Object.keys(PROCESSOR_REGISTRY);
}
