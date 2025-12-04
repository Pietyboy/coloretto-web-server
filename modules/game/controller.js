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
    const state = await gameService.getGameState(id);
    res.json({ state });
  } catch (err) {
    next(err);
  }
};

export const createNewGame = async (req, res, next) => {
  try {
    const { maxSeatsCount, turnTime, gameName } = req.body;
    const result = await gameService.createNewGame(maxSeatsCount, turnTime, gameName);
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
    const result = await gameService.makeTurnRow(playerId, gameId, rowId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const makeTurnCard = async (req, res, next) => {
  try {
    const { playerId, gameId, rowId } = req.body;
    const result = await gameService.makeTurnCard(playerId, gameId, rowId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const chooseColors = async (req, res, next) => {
  try {
    const { playerId, colorIds } = req.body;
    const result = await gameService.chooseColors(playerId, colorIds);
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
    const result = await gameService.finishGame(gameId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};