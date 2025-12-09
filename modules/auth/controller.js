import * as authService from './service.js';

const getRefreshCookieOptions = () => {
  const maxAgeDays = Number(process.env.REFRESH_TOKEN_MAX_AGE_DAYS || 7);
  const maxAge = Number.isFinite(maxAgeDays) ? maxAgeDays * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const sameSiteRaw = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const sameSite = ['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax';
  const secureEnv = process.env.COOKIE_SECURE === 'true';
  const secure = secureEnv || process.env.NODE_ENV === 'production' || sameSite === 'none';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: process.env.COOKIE_PATH || '/api/auth',
    maxAge,
  };
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', { ...getRefreshCookieOptions(), maxAge: 0 });
};

const sendAuthResponse = (res, result) => {
  setRefreshCookie(res, result.refreshToken);
  const { refreshToken, ...rest } = result;
  res.json(rest);
};

export const authenticate = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await authService.authenticate(username, password);
    sendAuthResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await authService.login(username, password);
    sendAuthResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const tokenFromCookie = req.cookies?.refreshToken;
    const tokenFromBody = req.body?.refreshToken;
    const refreshToken = tokenFromCookie || tokenFromBody;

    const result = await authService.refreshSession(refreshToken);
    sendAuthResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const logout = async (_req, res, next) => {
  try {
    clearRefreshCookie(res);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
