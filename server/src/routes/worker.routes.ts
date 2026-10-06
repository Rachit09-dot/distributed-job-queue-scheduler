import { Router } from 'express';
import { getWorkersHandler, getWorkerByIdHandler } from '../controllers/worker.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getWorkersHandler);
router.get('/:id', getWorkerByIdHandler);

export default router;
