import * as gameModel from './model.js';

const AUTO_START_DEBUG =
  ['1', 'true', 'yes', 'on'].includes(String(process.env.AUTO_START_DEBUG ?? '').trim().toLowerCase());

const debugAutoStart = (message, payload) => {
  if (!AUTO_START_DEBUG) return;
  if (payload !== undefined) {
    console.log('[auto-start]', message, payload);
    return;
  }
  console.log('[auto-start]', message);
};

const normalizeStatus = (statusCandidate) => {
  if (typeof statusCandidate !== 'string') return null;
  const normalized = statusCandidate.trim().toLowerCase();
  return normalized ? normalized : null;
};

const isGameAlreadyStarted = (stateRecord) => {
  if (!stateRecord || typeof stateRecord !== 'object') return false;

  if (stateRecord.isGameFinished === true || stateRecord.is_game_finished === true) {
    return true;
  }

  const statusCandidate = stateRecord.gameStatus ?? stateRecord.status ?? stateRecord.game_status;
  const status = normalizeStatus(statusCandidate);
  if (!status) return false;

  return (
    status.includes('pause') ||
    status.includes('finish') ||
    status.includes('active') ||
    status.includes('progress') ||
    status.includes('in_progress') ||
    status.includes('inprogress')
  );
};

const getPlayersCount = (stateRecord) => {
  if (!stateRecord || typeof stateRecord !== 'object') return null;

  if (Array.isArray(stateRecord.players)) return stateRecord.players.length;

  const raw =
    stateRecord.currentPlayersCount ??
    stateRecord.current_players_count ??
    stateRecord.playersCount ??
    stateRecord.players_count;

  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : null;
};

const getMaxPlayerCount = (stateRecord) => {
  if (!stateRecord || typeof stateRecord !== 'object') return null;

  const raw =
    stateRecord.maxPlayerCount ??
    stateRecord.max_player_count ??
    stateRecord.maxSeatsCount ??
    stateRecord.max_seats_count ??
    stateRecord.seats;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : null;
};

const maybeAutoStartGame = async (gameId, triggeringUserId) => {
  debugAutoStart('maybeAutoStartGame()', { gameId, triggeringUserId });
  const state = await gameModel.fetchGameState(gameId);
  if (!state || typeof state !== 'object') {
    debugAutoStart('skip: state is not object');
    return false;
  }

  const stateRecord = state;
  if (isGameAlreadyStarted(stateRecord)) {
    debugAutoStart('skip: already started', {
      status: stateRecord.gameStatus ?? stateRecord.status ?? stateRecord.game_status,
    });
    return false;
  }

  const maxPlayerCount = getMaxPlayerCount(stateRecord);
  if (!maxPlayerCount || maxPlayerCount <= 0) {
    debugAutoStart('skip: invalid maxPlayerCount', {
      maxPlayerCount: stateRecord.maxPlayerCount ?? stateRecord.max_player_count ?? stateRecord.maxSeatsCount ?? stateRecord.max_seats_count ?? stateRecord.seats,
    });
    return false;
  }

  const playersCount = getPlayersCount(stateRecord);
  if (!playersCount || playersCount !== maxPlayerCount) {
    debugAutoStart('skip: not full yet', { playersCount, maxPlayerCount });
    return false;
  }

  const startUserIds = [];
  const addStartUserId = (candidate) => {
    const asNumber = Number(candidate);
    if (!Number.isFinite(asNumber) || asNumber <= 0) return;
    if (!startUserIds.some(id => Number(id) === asNumber)) {
      startUserIds.push(asNumber);
    }
  };

  addStartUserId(await gameModel.fetchGameHostUserId(gameId));
  addStartUserId(stateRecord.hostUserId ?? stateRecord.host_user_id);
  addStartUserId(stateRecord.creatorId ?? stateRecord.creator_id);

  if (Array.isArray(stateRecord.players)) {
    const playersSorted = [...stateRecord.players].sort((a, b) => {
      const turnA = Number(a?.turnNumber ?? a?.turn_number);
      const turnB = Number(b?.turnNumber ?? b?.turn_number);
      if (!Number.isFinite(turnA) && !Number.isFinite(turnB)) return 0;
      if (!Number.isFinite(turnA)) return 1;
      if (!Number.isFinite(turnB)) return -1;
      return turnA - turnB;
    });

    for (const player of playersSorted) {
      addStartUserId(player?.userId ?? player?.user_id ?? player?.userid);
    }
  }

  addStartUserId(triggeringUserId);
  debugAutoStart('startUserIds', startUserIds);

  for (const startUserId of startUserIds) {
    const startResult = await gameModel.fetchStartGame(gameId, startUserId);
    const startError = startResult && typeof startResult === 'object' ? startResult.error : undefined;
    debugAutoStart('try start', { startUserId, startError, startResult });
    if (!(typeof startError === 'string' && startError.trim())) {
      return true;
    }
  }

  return false;
};

const requirePlayerIdForGame = async (gameId, userId) => {
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }

  const player = await gameModel.fetchPlayerForGame(gameId, userId);
  const playerId = Number(player?.player_id ?? player?.playerId);
  if (!Number.isFinite(playerId) || playerId <= 0) {
    const err = new Error('Пользователь не подключён к игре');
    err.status = 403;
    throw err;
  }

  return playerId;
};

export const getGamesList = async () => {
  return gameModel.fetchGamesList();
};

export const getGameState = async (gameId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchGameState(gameId);
};

export const createNewGame = async (maxSeatsCount, turnTime, gameName, nickname, userId) => {
  if (!maxSeatsCount) {
    const err = new Error('Требуется количество мест');
    err.status = 400;
    throw err;
  }

  if (!turnTime) {
    const err = new Error('Требуется время на ход');
    err.status = 400;
    throw err;
  }

  if (!gameName) {
    const err = new Error('Требуется название игры');
    err.status = 400;
    throw err;
  }

  if (!nickname) {
    const err = new Error('Требуется никнейм');
    err.status = 400;
    throw err;
  }

  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchNewGame(maxSeatsCount, turnTime, gameName, userId, nickname);
};

export const getGameScores = async (gameId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchGameScores(gameId);
};

export const getHostedGames = async (userId) => {
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchHostedGames(userId);
};

export const startGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }
  return gameModel.fetchStartGame(gameId, userId);
};

export const deleteGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }
  return gameModel.fetchDeleteGame(gameId, userId);
};

export const pauseGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }
  return gameModel.fetchPauseGame(gameId, userId);
};

export const resumeGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }
  return gameModel.fetchResumeGame(gameId, userId);
};

export const resetGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }
  return gameModel.fetchResetGame(gameId, userId);
};

export const joinGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }

  const result = await gameModel.fetchJoinGame(gameId, userId);

  const error = result && typeof result === 'object' ? result.error : undefined;
  if (typeof error === 'string' && error.trim()) {
    return result;
  }

  try {
    await maybeAutoStartGame(gameId, userId);
  } catch (_err) {
    return result;
  }

  return result;
};

export const maybeAutoStartGameIfReady = async (gameId, userId) => {
  if (!gameId || !userId) return false;
  try {
    return await maybeAutoStartGame(gameId, userId);
  } catch (_err) {
    return false;
  }
};

export const makeTurnRow = async (gameId, rowId, userId) => {
  if (!rowId) {
    const err = new Error('Требуется ID ряда');
    err.status = 400;
    throw err;
  }

  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  const playerId = await requirePlayerIdForGame(gameId, userId);
  return gameModel.fetchMakeTurnRow(playerId, gameId, rowId);
};

export const makeTurnCard = async (gameId, rowId, userId) => {
  if (!rowId) {
    const err = new Error('Требуется ID ряда');
    err.status = 400;
    throw err;
  }

  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  const playerId = await requirePlayerIdForGame(gameId, userId);
  return gameModel.fetchMakeTurnCard(playerId, gameId, rowId);
};

export const chooseColors = async (gameId, colorIds, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  if (!colorIds) {
    const err = new Error('Требуются ID цветов');
    err.status = 400;
    throw err;
  }

  const playerId = await requirePlayerIdForGame(gameId, userId);
  return gameModel.fetchChooseColors(playerId, colorIds);
};

export const createNewPlayer = async (gameId, userId, nickname) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }

  if (!nickname) {
    const err = new Error('Требуется никнейм');
    err.status = 400;
    throw err;
  }

  const result = await gameModel.fetchNewPlayer(gameId, userId, nickname);

  const error = result && typeof result === 'object' ? result.error : undefined;
  if (typeof error === 'string' && error.trim()) {
    return result;
  }

  try {
    await maybeAutoStartGame(gameId, userId);
  } catch (_err) {
    return result;
  }

  return result;
};

export const finishGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchFinishGame(gameId, userId);
};

export const getCardInfo = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }

  return gameModel.fetchCardInfo(gameId, userId);
};

export const getPlayerForGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('Требуется ID пользователя');
    err.status = 400;
    throw err;
  }
  return gameModel.fetchPlayerForGame(gameId, userId);
};

export const setJokerColors = async (gameId, choices, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(choices)) {
    const err = new Error('Требуется массив выборов');
    err.status = 400;
    throw err;
  }

  await requirePlayerIdForGame(gameId, userId);
  return gameModel.fetchSetJokerColors(gameId, userId, choices);
};

export const leaveGame = async (gameId, userId) => {
  if (!gameId) {
    const err = new Error('Требуется ID игры');
    err.status = 400;
    throw err;
  }

  const playerId = await requirePlayerIdForGame(gameId, userId);
  return gameModel.fetchLeaveGame(gameId, playerId, userId);
};
