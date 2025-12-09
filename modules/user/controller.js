import * as authService from '../auth/service.js';

export const createUser = async (req, res, next) => {
  try {
    const { login: username, password } = req.body || {};
    const result = await authService.login(username, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const checkUser = async (req, res, next) => {
  try {
    const { login: username, password } = req.body || {};
    const result = await authService.authenticate(username, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
