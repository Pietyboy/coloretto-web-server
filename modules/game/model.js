import { query } from '../../db.js';

export const fetchGamesList = async () => {
  const { rows } = await query('SELECT "get_games_list"()');
  return rows[0]?.get_games_list;
};

export const fetchGameState = async (gameId) => {
  const { rows } = await query('SELECT "get_game_state"($1)', [gameId]);
  return rows[0]?.get_game_state;
};

export const fetchNewGame = async (maxSeatsCount, turnTime, gameName, userId) => {
  const { rows } = await query('SELECT "game_create_game"($1, $2, $3, $4)', [userId, gameName, maxSeatsCount, turnTime]);
  return rows[0]?.game_create_game;
};

export const fetchGameScores = async (gameId) => {
  const { rows } = await query('SELECT "get_game_scores"($1)', [gameId]);
  return rows[0]?.get_game_scores;
};

export const fetchHostedGames = async (userId) => {
  const { rows } = await query('SELECT "game_get_hosted_games"($1)', [userId]);
  return rows[0]?.game_get_hosted_games;
};

export const fetchPauseGame = async (gameId, userId) => {
  const { rows } = await query('SELECT "game_pause_game"($1, $2)', [gameId, userId]);
  return rows[0]?.game_pause_game;
};

export const fetchResumeGame = async (gameId, userId) => {
  const { rows } = await query('SELECT "game_resume_game"($1, $2)', [gameId, userId]);
  return rows[0]?.game_resume_game;
};

export const fetchResetGame = async (gameId, userId) => {
  const { rows } = await query('SELECT "game_reset_to_waiting"($1, $2)', [gameId, userId]);
  return rows[0]?.game_reset_to_waiting;
};

export const fetchStartGame = async (gameId, userId) => {
  const { rows } = await query('SELECT "game_start_game"($1, $2)', [gameId, userId]);
  return rows[0]?.game_start_game;
};

export const fetchDeleteGame = async (gameId, userId) => {
  const { rows } = await query('SELECT "game_delete_game"($1, $2)', [userId, gameId]);
  return rows[0]?.game_delete_game;
};

export const fetchJoinGame = async (gameId, userId) => {
  const { rows } = await query('SELECT "game_join_game"($1, $2)', [gameId, userId]);
  return rows[0]?.game_join_game;
};

export const fetchLeaveGame = async (gameId, playerId, userId) => {
  const { rows } = await query('SELECT "game_leave_game"($1, $2, $3)', [gameId, playerId, userId]);
  return rows[0]?.game_leave_game;
};

export const fetchMakeTurnRow = async (playerId, gameId, rowId) => {
  const { rows } = await query('SELECT "game_make_turn_row"($1, $2, $3)', [gameId, playerId, rowId]);
  return rows[0]?.game_make_turn_row;
};

export const fetchMakeTurnCard = async (playerId, gameId, rowId, cardId) => {
  if (cardId !== undefined && cardId !== null) {
    try {
      const { rows } = await query('SELECT "game_make_turn_card"($1, $2, $3, $4)', [
        playerId,
        gameId,
        rowId,
        cardId,
      ]);
      return rows[0]?.game_make_turn_card;
    } catch (err) {
      if (err?.code !== '42883') {
        throw err;
      }
    }
  }

  const { rows } = await query('SELECT "game_make_turn_card"($1, $2, $3)', [playerId, gameId, rowId]);
  return rows[0]?.game_make_turn_card;
};

export const fetchChooseColors = async (playerId, colorIds) => {
  const { rows } = await query('SELECT "game_choose_colors"($1, $2)', [playerId, colorIds]);
  return rows[0]?.game_choose_colors;
};

export const fetchNewPlayer = async (gameId, userId, nickname) => {
  const { rows } = await query('SELECT "game_create_player"($1, $2, $3)', [gameId, userId, nickname]);
  return rows[0]?.game_create_player;
};

const resolveHostUserId = async (gameId, tableName, gameIdColumn, userIdColumn) => {
  const { rows } = await query(
    `SELECT "${userIdColumn}" as user_id
     FROM ${tableName}
     WHERE "${gameIdColumn}" = $1
     LIMIT 1`,
    [gameId],
  );

  const raw = rows[0]?.user_id;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : null;
};

export const fetchGameHostUserId = async (gameId) => {
  const normalizedGameId = Number(gameId);
  if (!Number.isFinite(normalizedGameId)) return null;

  const tablesToTry = ['game_games', 'games'].map(name => `"${name}"`);
  const gameIdColumns = ['game_id', 'id'];
  const userIdColumns = ['user_id', 'creator_id', 'host_id', 'host_user_id', 'owner_id'];

  for (const tableName of tablesToTry) {
    for (const gameIdColumn of gameIdColumns) {
      for (const userIdColumn of userIdColumns) {
        try {
          const userId = await resolveHostUserId(normalizedGameId, tableName, gameIdColumn, userIdColumn);
          if (userId !== null) {
            return userId;
          }
        } catch (err) {
          const code = err?.code;
          if (code === '42P01' || code === '42703') {
            continue;
          }
          throw err;
        }
      }
    }
  }

  return null;
};

export const fetchFinishGame = async (gameId, userId) => {
  const { rows } = await query('SELECT "game_finish_game"($1, $2)', [gameId, userId]);
  return rows[0]?.game_finish_game;
};

export const fetchCardInfo = async (gameId, userId, cardId) => {
  const { rows } = await query('SELECT "game_get_card_info"($1, $2, $3)', [gameId, userId, cardId]);
  return rows[0]?.game_get_card_info;
};

export const fetchPlayerForGame = async (gameId, userId) => {
  const { rows } = await query('SELECT "game_get_player_for_game"($1, $2)', [gameId, userId]);
  return rows[0]?.game_get_player_for_game;
};

export const fetchSetJokerColors = async (gameId, userId, choices) => {
  console.log(JSON.stringify(choices))
  const { rows } = await query('SELECT "game_set_joker_colors"($1, $2, $3)', [
    gameId,
    userId,
    JSON.stringify(choices),
  ]);
  return rows[0]?.game_set_joker_colors;
};

export const fetchChooseJokerColors = async (gameId, playerId, choices) => {
  const { rows } = await query('SELECT "game_choose_joker_colors"($1, $2, $3::jsonb)', [
    gameId,
    playerId,
    JSON.stringify(choices),
  ]);
  return rows[0]?.game_choose_joker_colors;
};
