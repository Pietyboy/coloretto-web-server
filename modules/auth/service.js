import * as authModel from './model.js';

export const authenticate = async (username, password) => {
  if (!username || !password) {
    const err = new Error('Username and password are required');
    err.status = 400;
    throw err;
  }

  const result = await authModel.authenticate(username, password);

  if (!result) {
    const err = new Error('Failed to login');
    err.status = 500;
    throw err;
  }

  return result;
};
