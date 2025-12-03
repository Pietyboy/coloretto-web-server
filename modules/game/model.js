import { query } from '../../db.js';

export const fetchGamesList = async () => {
  const { rows } = await query('SELECT "get_games_list"()');
  return rows[0]?.get_games_list;
};

export const fetchGameState = async (gameId) => {
  const { rows } = await query('SELECT "get_game_state"($1)', [gameId]);
  return rows[0]?.get_game_state;
};
