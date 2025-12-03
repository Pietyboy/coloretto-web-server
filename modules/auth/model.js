import { query } from '../../db.js';

export const authenticate = async (username, password) => {
  const { rows } = await query('SELECT "game_auth"($1, $2)', [
    username,
    password,
  ]);

  const payload = rows[0]?.game_auth;

  if (!payload) {
    return null;
  }

  return JSON.parse(payload);
};
