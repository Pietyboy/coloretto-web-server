import * as authService from './service.js';

export const authenticate = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await authService.authenticate(username, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await authService.login(username, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
