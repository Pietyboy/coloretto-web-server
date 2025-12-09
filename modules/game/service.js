import * as gameModel from './model.js';

export const getGamesList = async () => {
  return gameModel.fetchGamesList();
};

export const getGameState = async (gameId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchGameState(gameId);
};

export const createNewGame = async (maxSeatsCount, turnTime, gameName) => {
  if (!maxSeatsCount) {
    const err = new Error('Требуется количество мест');
    err.status = 400;
    throw err;
  }

  if (!turnTime) {
    const err = new Error('Требуется время на ход');
    err.status = 400;
    throw err;
  }

  if (!gameName) {
    const err = new Error('Требуется название игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchNewGame(maxSeatsCount, turnTime, gameName);
};

export const getGameScores = async (gameId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchGameScores(gameId);
};

export const getHostedGames = async (userId) => {
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchHostedGames(userId);
};

export const startGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }
  return gameModel.fetchStartGame(gameId, userId);
};

export const deleteGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }
  return gameModel.fetchDeleteGame(gameId, userId);
};

export const joinGame = async (gameId, userId, nickName) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchJoinGame(gameId, userId, nickName);
};

export const makeTurnRow = async (playerId, gameId, rowId) => {
  if (!playerId) {
    const err = new Error('Требуется ID игрока');
    err.status = 400;
    throw err;
  }

  if (!rowId) {
    const err = new Error('Требуется ID ряда');
    err.status = 400;
    throw err;
  }

  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchMakeTurnRow(playerId, gameId, rowId);
};

export const makeTurnCard = async (playerId, gameId, rowId) => {
  if (!playerId) {
    const err = new Error('Требуется ID игрока');
    err.status = 400;
    throw err;
  }

  if (!rowId) {
    const err = new Error('Требуется ID ряда');
    err.status = 400;
    throw err;
  }

  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchMakeTurnCard(playerId, gameId, rowId);
};

export const chooseColors = async (playerId, colorIds) => {
  if (!playerId) {
    const err = new Error('Требуется ID игрока');
    err.status = 400;
    throw err;
  }

  if (!colorIds) {
    const err = new Error('Требуются ID цветов');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchChooseColors(playerId, colorIds);
};

export const createNewPlayer = async (gameId, nickname) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  if (!nickname) {
    const err = new Error('Требуется никнейм');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchNewPlayer(gameId, nickname);
};

export const finishGame = async (gameId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchFinishGame(gameId);
};

export const getCardInfo = async (gameId, cardId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  if (!cardId) {
    const err = new Error('Требуется ID карты');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchCardInfo(gameId, cardId);
};

export const leaveGame = async (gameId, playerId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }
  if (!playerId) {
    const err = new Error('Требуется ID игрока');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchLeaveGame(gameId, playerId);
};
