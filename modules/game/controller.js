import { clearOldAutoMarks, maybeAutoMove } from '../../auto-play.js';
import { getConnections, touchPresence } from '../../presence.js';
import * as gameService from './service.js';

export const getGamesList = async (_req, res, next) => {
  try {
    const list = await gameService.getGamesList();
    res.json(list);
  } catch (err) {
    next(err);
  }
};

export const getGameState = async (req, res, next) => {
  try {
    const { id } = req.params;
    const playerId = req.userId || (req.query?.playerId ? Number(req.query.playerId) : undefined);
    if (playerId) {
      touchPresence(id, playerId);
    }
    clearOldAutoMarks();
    let state = await gameService.getGameState(id);
    let connections = getConnections(id);

    const autoPlayed = await maybeAutoMove(id, state, connections);
    if (autoPlayed) {
      state = await gameService.getGameState(id);
      connections = getConnections(id);
    }

    const playersWithPresence = Array.isArray(state?.players)
      ? state.players.map(p => ({
          ...p,
          isConnected: connections.get(p.playerId) ?? false,
        }))
      : state?.players;

    res.json({
      state: {
        ...state,
        players: playersWithPresence,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createNewGame = async (req, res, next) => {
  try {
    const { maxSeatsCount, turnTime, gameName, playerId } = req.body;
    const result = await gameService.createNewGame(maxSeatsCount, turnTime, gameName, playerId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getGameScores = async (req, res, next) => {
  try {
    const { id } = req.params;
    const scores = await gameService.getGameScores(id);
    res.json({ scores });
  } catch (err) {
    next(err);
  }
};

export const makeTurnRow = async (req, res, next) => {
  try {
    const { playerId, gameId, rowId } = req.body;
    const userId = req.userId;
    const result = await gameService.makeTurnRow(playerId, gameId, rowId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const startGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.startGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const deleteGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.deleteGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const pauseGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.pauseGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resumeGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.resumeGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resetGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.resetGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const joinGame = async (req, res, next) => {
  try {
    const { gameId, nickname } = req.body;
    const userId = req.userId;
    const result = await gameService.joinGame(gameId, userId, nickname || userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const leaveGame = async (req, res, next) => {
  try {
    const { gameId, playerId } = req.body;
    const userId = req.userId;
    const result = await gameService.leaveGame(gameId, playerId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getHostedGames = async (req, res, next) => {
  try {
    const userId = req.userId;
    const result = await gameService.getHostedGames(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const makeTurnCard = async (req, res, next) => {
  try {
    const { playerId, gameId, rowId } = req.body;
    const userId = req.userId;
    const result = await gameService.makeTurnCard(playerId, gameId, rowId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const chooseColors = async (req, res, next) => {
  try {
    const { playerId, colorIds, gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.chooseColors(playerId, colorIds, gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createNewPlayer = async (req, res, next) => {
  try {
    const { gameId, nickname } = req.body;
    const result = await gameService.createNewPlayer(gameId, nickname);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const finishGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.finishGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getCardInfo = async (req, res, next) => {
  try {
    const { gameId, cardId } = req.params;
    const result = await gameService.getCardInfo(gameId, cardId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getPlayerForGame = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;
    const result = await gameService.getPlayerForGame(gameId, userId);
    if (!result || !result.player_id) {
      return res.json({ inGame: false });
    }
    res.json({
      inGame: true,
      player_id: result.player_id,
      nickname: result.nickname,
    });
  } catch (err) {
    next(err);
  }
};

export const chooseJokerColors = async (req, res, next) => {
  try {
    const { gameId, playerId, choices } = req.body;
    const userId = req.userId;
    const result = await gameService.chooseJokerColors(gameId, playerId, choices, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
