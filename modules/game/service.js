import * as gameModel from './model.js';

export const getGamesList = async () => {
  return gameModel.fetchGamesList();
};

export const getGameState = async (gameId) => {
  if (!gameId) {
    const err = new Error('Game ID is required');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchGameState(gameId);
};

export const createNewGame = async (maxSeatsCount, turnTime, gameName) => {
  if (!maxSeatsCount) {
    const err = new Error('Number of seats is required');
    err.status = 400;
    throw err;
  }

  if (!turnTime) {
    const err = new Error('Turn time is required');
    err.status = 400;
    throw err;
  }

  if (!gameName) {
    const err = new Error('Game name is required');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchNewGame(maxSeatsCount, turnTime, gameName);
};

export const getGameScores = async (gameId) => {
  if (!gameId) {
    const err = new Error('Game ID is required');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchGameScores(gameId);
};

export const joinGame = async (gameId, nickName) => {
  if (!gameId) {
    const err = new Error('Turn time is required');
    err.status = 400;
    throw err;
  }

  if (!nickName) {
    const err = new Error('Game name is required');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchNewGame(maxSeatsCount, turnTime, gameName);
};

export const makeTurnRow = async (playerId, gameId, rowId) => {
  if (!playerId) {
    const err = new Error('Player ID is required');
    err.status = 400;
    throw err;
  }

  if (!rowId) {
    const err = new Error('Row ID is required');
    err.status = 400;
    throw err;
  }

  if (!gameId) {
    const err = new Error('Game ID is required');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchMakeTurnRow(playerId, gameId, rowId);
};

export const makeTurnCard = async (playerId, gameId, rowId) => {
  if (!playerId) {
    const err = new Error('Player ID is required');
    err.status = 400;
    throw err;
  }

  if (!rowId) {
    const err = new Error('Row ID is required');
    err.status = 400;
    throw err;
  }

  if (!gameId) {
    const err = new Error('Game ID is required');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchMakeTurnCard(playerId, gameId, rowId);
};

export const chooseColors = async (playerId, colorIds) => {
  if (!playerId) {
    const err = new Error('Player ID is required');
    err.status = 400;
    throw err;
  }

  if (!colorIds) {
    const err = new Error('Color Ids is required');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchChooseColors(playerId, colorIds);
};

export const createNewPlayer = async (gameId, nickname) => {
  if (!gameId) {
    const err = new Error('Game ID seats is required');
    err.status = 400;
    throw err;
  }

  if (!nickname) {
    const err = new Error('Nickname is required');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchNewPlayer(gameId, nickname);
};