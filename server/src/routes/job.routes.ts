import { Router } from 'express';
import {
  createJobHandler,
  getJobsHandler,
  getJobByIdHandler,
  updateJobHandler,
  deleteJobHandler,
  cancelJobHandler,
  retryJobHandler,
  scheduleJobHandler,
  getJobExecutionsHandler,
} from '../controllers/job.controller';
import { authenticate } from '../middleware/auth';
import { jobCreationLimiter } from '../middleware/rateLimiter';

const router = Router();

// All job routes require authentication
router.use(authenticate);

router.post('/', jobCreationLimiter, createJobHandler);
router.get('/', getJobsHandler);
router.get('/:id', getJobByIdHandler);
router.patch('/:id', updateJobHandler);
router.delete('/:id', deleteJobHandler);

// Job lifecycle actions
router.post('/:id/cancel', cancelJobHandler);
router.post('/:id/retry', retryJobHandler);
router.post('/:id/schedule', scheduleJobHandler);

// Execution history
router.get('/:id/executions', getJobExecutionsHandler);

export default router;
