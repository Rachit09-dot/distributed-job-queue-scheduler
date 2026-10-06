import { Router } from 'express';
import { statsHandler, jobStatsHandler, workerStatsHandler } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/stats', statsHandler);
router.get('/job-stats', jobStatsHandler);
router.get('/worker-stats', workerStatsHandler);

export default router;
