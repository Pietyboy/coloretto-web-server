import { Router } from 'express';
import * as controller from './controller.js';

const router = Router();

router.post('/', controller.authenticate);

export default router;
