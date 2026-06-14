import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { backupRateLimit } from '../middleware/rateLimitMiddleware.js';
import {
  getBackups,
  getStatus,
  removeBackup,
  restoreBackup,
  runBackup,
  runRetention,
  validateBackup,
} from '../controllers/backupController.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN'), backupRateLimit);

router.get('/status', getStatus);
router.get('/', getBackups);
router.post('/run', runBackup);
router.post('/retention', runRetention);
router.post('/validate/:id', validateBackup);
router.post('/restore/:id', restoreBackup);
router.delete('/:id', removeBackup);

export default router;
