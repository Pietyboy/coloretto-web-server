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
router.post('/pause', controller.pauseGame);
router.post('/resume', controller.resumeGame);
router.post('/reset', controller.resetGame);
router.post('/join', controller.joinGame);
router.post('/leave', controller.leaveGame);
router.post('/turn/row', controller.makeTurnRow);
router.post('/turn/card', controller.makeTurnCard);
router.post('/colors', controller.chooseColors);
router.post('/choose-colors', controller.chooseColors);
router.post('/joker/colors', controller.setJokerColors);
router.post('/create-player', controller.createNewPlayer);
router.post('/create/player', controller.createNewPlayer);
router.post('/finish/game', controller.finishGame);
router.get('/:gameId/card/:cardId', controller.getCardInfo);
router.get('/me/:gameId', controller.getPlayerForGame);

export default router;
