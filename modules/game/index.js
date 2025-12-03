import { Router } from 'express';
import * as controller from './controller.js';

const router = Router();

router.get('/list', controller.getGamesList);
router.get('/state/:id', controller.getGameState);
router.post('/create/game', controller.createNewGame)
router.get('/score/:id', controller.getGameScores);
router.post('/turn/row', controller.makeTurnRow);
router.post('/turn/card', controller.makeTurnRow);
router.post('/colors', controller.chooseColors);
router.post('/create/player', controller.createNewPlayer);

export default router;
