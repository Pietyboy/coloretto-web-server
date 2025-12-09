import { Router } from 'express';
import * as controller from './controller.js';

const router = Router();

router.post('/create', controller.createUser);
router.post('/check', controller.checkUser);

export default router;
