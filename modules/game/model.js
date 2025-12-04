import { query } from '../../db.js';

export const fetchGamesList = async () => {
  const { rows } = await query('SELECT "get_games_list"()');
  return rows[0]?.get_games_list;
};

export const fetchGameState = async (gameId) => {
  const { rows } = await query('SELECT "get_game_state"($1)', [gameId]);
  return rows[0]?.get_game_state;
};

export const fetchNewGame = async (maxSeatsCount, turnTime, gameName) => {
  const { rows } = await query('SELECT "game_create_game"($1, $2, $3)', [maxSeatsCount, turnTime, gameName]);
  return rows[0]?.get_create_game;
};

export const fetchGameScores = async (gameId) => {
  const { rows } = await query('SELECT "get_game_scores"($1)', [gameId]);
  return rows[0]?.get_game_scores;
};

export const fetchJoinGame = async (gameId, nickName) => {
  const { rows } = await query('SELECT "game_join_game"($1, $2)', [gameId, nickName]);
  return rows[0]?.game_join_game;
};

export const fetchMakeTurnRow = async (playerId, gameId, rowId) => {
  const { rows } = await query('SELECT "game_make_turn_row"($1, $2, $3)', [playerId, gameId, rowId]);
  return rows[0]?.game_make_turn_row;
};

export const fetchMakeTurnCard = async (playerId, gameId, rowId) => {
  const { rows } = await query('SELECT "game_make_turn_card"($1, $2, $3)', [playerId, gameId, rowId]);
  return rows[0]?.game_make_turn_card;
};

export const fetchChooseColors = async (playerId, colorIds) => {
  const { rows } = await query('SELECT "game_make_turn_card"($1, $2)', [playerId, colorIds]);
  return rows[0]?.game_make_turn_card;
};

export const fetchNewPlayer = async (gameId, nickname) => {
  const { rows } = await query('SELECT "game_create_player"($1, $2)', [gameId, nickname]);
  return rows[0]?.game_create_player;
};

export const fetchFinishGame = async (gameId) => {
  const { rows } = await query('SELECT "game_finish_game"($1)', [gameId]);
  return rows[0]?.game_finish_game;
};