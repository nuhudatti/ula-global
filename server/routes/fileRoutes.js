import { Router } from 'express';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { getDeliveryUrl, streamFile } from '../controllers/fileController.js';

const router = Router();

/** Resources + open assignment papers are public; submissions/suggestions need login. */
router.use(optionalAuth);

router.get('/delivery', getDeliveryUrl);
router.get('/stream', streamFile);

export default router;
