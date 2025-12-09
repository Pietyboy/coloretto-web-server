import jwt from 'jsonwebtoken';
import * as authModel from './model.js';

const ensureEnv = (name, message) => {
  if (!process.env[name]) {
    const err = new Error(message || `${name} не настроен`);
    err.status = 500;
    throw err;
  }
};

const ACCESS_TTL = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const createTokenPair = (userId) => {
  ensureEnv('JWT_SECRET', 'JWT secret is not configured');
  ensureEnv('JWT_REFRESH_SECRET', 'JWT refresh secret is not configured');

  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL },
  );

  return { accessToken, refreshToken };
};

const validateCredentials = (username, password) => {
  if (!username || !password) {
    const err = new Error('Требуются логин и пароль');
    err.status = 400;
    throw err;
  }
};

const assertUser = (user) => {
  if (!user) {
    const err = new Error('Неверный логин или пароль');
    err.status = 401;
    throw err;
  }

  if (!user.userId) {
    const err = new Error(user.error || 'Неверный логин или пароль');
    err.status = 401;
    throw err;
  }
};

const buildAuthResponse = (user) => {
  const { accessToken, refreshToken } = createTokenPair(user.userId);
  // Keep backward compatibility: token === accessToken
  return { ...user, userId: user.userId, token: accessToken, accessToken, refreshToken };
};

export const authenticate = async (username, password) => {
  validateCredentials(username, password);
  const result = await authModel.authenticate(username, password);
  assertUser(result);
  return buildAuthResponse(result);
};

export const login = async (username, password) => {
  validateCredentials(username, password);
  const result = await authModel.login(username, password);

  if (!result) {
    const err = new Error('Неверный логин или пароль');
    err.status = 401;
    throw err;
  }

  if ('error' in result) {
    const err = new Error(result.error);
    err.status = 401;
    throw err;
  }

  assertUser(result);
  return buildAuthResponse(result);
};

export const refreshSession = async (refreshToken) => {
  ensureEnv('JWT_REFRESH_SECRET', 'Секрет для refresh-токена не настроен');
  if (!refreshToken) {
    const err = new Error('Требуется refresh-токен');
    err.status = 401;
    throw err;
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (!payload?.userId || payload?.type !== 'refresh') {
      const err = new Error('Неверный refresh-токен');
      err.status = 401;
      throw err;
    }

    return buildAuthResponse({ userId: payload.userId });
  } catch (err) {
    const error = new Error('Неверный или просроченный refresh-токен');
    error.status = 401;
    throw error;
  }
};
