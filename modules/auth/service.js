import jwt from 'jsonwebtoken';
import * as authModel from './model.js';

export const authenticate = async (username, password) => {
  if (!username || !password) {
    const err = new Error('Username and password are required');
    err.status = 400;
    throw err;
  }

  if (!process.env.JWT_SECRET) {
    const err = new Error('JWT secret is not configured');
    err.status = 500;
    throw err;
  }

  const result = await authModel.authenticate(username, password);

  if (!result) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const userId = result.userId

  if (!userId) {
    const err = new Error(result.error || 'Invalid credentials');
    err.status = 401;
    throw err;
  }

  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
  );

  return { ...result, token, userId };
};

export const login = async (username, password) => {
  if (!username || !password) {
    const err = new Error('Username and password are required');
    err.status = 400;
    throw err;
  }

  if (!process.env.JWT_SECRET) {
    const err = new Error('JWT secret is not configured');
    err.status = 500;
    throw err;
  }

  const result = await authModel.login(username, password);

  if ('error' in result) {
    const err = new Error(result.error);
    err.status = 401;
    throw err;
  }

  const userId = result.userId

  if (!userId) {
    const err = new Error(result.error);
    err.status = 401;
    throw err;
  }

  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
  );

  return { ...result, token, userId };
};
