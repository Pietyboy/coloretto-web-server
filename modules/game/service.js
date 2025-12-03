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
