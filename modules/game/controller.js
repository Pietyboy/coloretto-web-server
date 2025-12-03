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
