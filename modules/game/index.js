import { Router } from 'express';
import * as controller from './controller.js';

const router = Router();

router.get('/list', controller.getGamesList);
router.get('/state/:id', controller.getGameState);
router.post('/create/game', controller.createNewGame)
router.get('/score/:id', controller.getGameScores);
router.get('/hosted', controller.getHostedGames);
router.post('/start', controller.startGame);
router.post('/delete', controller.deleteGame);
router.post('/join', controller.joinGame);
router.post('/leave', controller.leaveGame);
router.post('/turn/row', controller.makeTurnRow);
router.post('/turn/card', controller.makeTurnCard);
router.post('/colors', controller.chooseColors);
router.post('/choose-colors', controller.chooseColors);
router.post('/create/player', controller.createNewPlayer);
router.post('/finish/game', controller.finishGame);
router.get('/:gameId/card/:cardId', controller.getCardInfo);

export default router;
