import * as gameModel from './model.js';

const ensurePlayerOwnership = async (playerId, gameId, userId) => {
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }
  const player = await gameModel.fetchPlayerForGame(gameId, userId);
  if (!player || Number(player.player_id) !== Number(playerId)) {
    const err = new Error('Недоступно для этого пользователя');
    err.status = 403;
    throw err;
  }
};

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

export const createNewGame = async (maxSeatsCount, turnTime, gameName, userId) => {
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

  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchNewGame(maxSeatsCount, turnTime, gameName, userId);
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

export const pauseGame = async (gameId, userId) => {
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
  return gameModel.fetchPauseGame(gameId, userId);
};

export const resumeGame = async (gameId, userId) => {
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
  return gameModel.fetchResumeGame(gameId, userId);
};

export const resetGame = async (gameId, userId) => {
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
  return gameModel.fetchResetGame(gameId, userId);
};

export const joinGame = async (gameId, userId) => {
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

  return gameModel.fetchJoinGame(gameId, userId);
};

export const makeTurnRow = async (playerId, gameId, rowId, userId) => {
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

  await ensurePlayerOwnership(playerId, gameId, userId);
  return gameModel.fetchMakeTurnRow(playerId, gameId, rowId);
};

export const makeTurnCard = async (playerId, gameId, rowId, userId) => {
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

  await ensurePlayerOwnership(playerId, gameId, userId);
  return gameModel.fetchMakeTurnCard(playerId, gameId, rowId);
};

export const chooseColors = async (playerId, colorIds, gameId, userId) => {
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

  if (gameId && userId) {
    await ensurePlayerOwnership(playerId, gameId, userId);
  }
  return gameModel.fetchChooseColors(playerId, colorIds);
};

export const createNewPlayer = async (gameId, userId, nickname) => {
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

  return gameModel.fetchNewPlayer(gameId, userId, nickname);
};

export const finishGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchFinishGame(gameId, userId);
};

export const getCardInfo = async (gameId, userId, cardId) => {
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

  if (!cardId) {
    const err = new Error('Требуется ID карты');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchCardInfo(gameId, userId, cardId);
};

export const leaveGame = async (gameId, playerId, userId) => {
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

  await ensurePlayerOwnership(playerId, gameId, userId);
  return gameModel.fetchLeaveGame(gameId, playerId);
};

export const getPlayerForGame = async (gameId, userId) => {
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
  return gameModel.fetchPlayerForGame(gameId, userId);
};

export const setJokerColors = async (gameId, playerId, choices, userId) => {
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

  if (!Array.isArray(choices)) {
    const err = new Error('Требуется массив выборов');
    err.status = 400;
    throw err;
  }

  await ensurePlayerOwnership(playerId, gameId, userId);
  return gameModel.fetchSetJokerColors(gameId, userId, choices);
};
