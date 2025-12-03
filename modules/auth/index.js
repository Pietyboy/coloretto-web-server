import { Router } from 'express';
import * as controller from './controller.js';

const router = Router();

router.post('/', controller.authenticate);
router.post('/login', controller.login);


export default router;
