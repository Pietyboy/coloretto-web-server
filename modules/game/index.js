import { Router } from 'express';
import * as controller from './controller.js';

const router = Router();

router.get('/list', controller.getGamesList);
router.get('/state/:id', controller.getGameState);

export default router;
