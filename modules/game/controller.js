import { clearOldAutoMarks, maybeAutoMove } from '../../auto-play.js';
import { getConnections, touchPresence } from '../../presence.js';
import * as gameService from './service.js';

const TURN_START_TIMEZONE_OFFSET_MINUTES = (() => {
  const raw = process.env.TURN_START_TIMEZONE_OFFSET_MINUTES;
  if (raw === undefined) return -180;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : -180;
})();

const TURN_START_HAS_TZ_RE = /([zZ]|[+-]\d{2}:?\d{2})$/;
const TURN_START_NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const TURN_START_TZ_HOURS_ONLY_RE = /[+-]\d{2}$/;

const normalizeTurnStartString = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (TURN_START_TZ_HOURS_ONLY_RE.test(trimmed)) {
    return `${trimmed}:00`;
  }

  return trimmed;
};

const pickClosestTimestampMs = (candidates, nowMs = Date.now()) => {
  const now = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now();
  const futureToleranceMs = 60_000;

  const normalized = candidates.filter(value => typeof value === 'number' && Number.isFinite(value));
  if (normalized.length === 0) return null;

  const notTooFuture = normalized.filter(value => value - now <= futureToleranceMs);
  const pool = notTooFuture.length ? notTooFuture : normalized;

  return pool.reduce((best, value) => (Math.abs(value - now) < Math.abs(best - now) ? value : best), pool[0]);
};

const parseTimestampToMs = (value, nowMs = Date.now()) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    return asNumber < 1e12 ? asNumber * 1000 : asNumber;
  }

  const normalized = normalizeTurnStartString(trimmed);
  const parsed = new Date(normalized).getTime();
  if (!Number.isFinite(parsed)) return null;

  const hasTimezone = TURN_START_HAS_TZ_RE.test(normalized);
  const isNaiveDateTime = TURN_START_NAIVE_DATETIME_RE.test(normalized);

  if (isNaiveDateTime && !hasTimezone && Number.isFinite(TURN_START_TIMEZONE_OFFSET_MINUTES)) {
    const serverOffsetMinutes = new Date(parsed).getTimezoneOffset();
    const legacyShiftMs = (TURN_START_TIMEZONE_OFFSET_MINUTES - serverOffsetMinutes) * 60_000;
    const utcOffsetShiftMs = (-TURN_START_TIMEZONE_OFFSET_MINUTES - serverOffsetMinutes) * 60_000;

    const best = pickClosestTimestampMs(
      [parsed, parsed + legacyShiftMs, parsed + utcOffsetShiftMs],
      nowMs,
    );

    if (typeof best === 'number') return best;
  }

  return parsed;
};

const getTurnDurationMs = (state) => {
  if (!state || typeof state !== 'object') return null;

  const secRaw =
    state.turnDuration
    ?? state.turn_duration
    ?? state.turnDurationSeconds
    ?? state.turn_duration_seconds;

  const sec = Number(secRaw);
  if (Number.isFinite(sec) && sec > 0) return Math.floor(sec * 1000);

  const msRaw =
    state.turnDurationMs
    ?? state.turn_duration_ms;

  const ms = Number(msRaw);
  if (Number.isFinite(ms) && ms > 0) return Math.floor(ms);

  return null;
};

const getTurnStartMs = (state, nowMs = Date.now()) => {
  if (!state || typeof state !== 'object') return null;

  const candidates = [
    state.currentTurnStartTime,
    state.turnStartTime,
    state.turnStart,
    state.turn_start,
    state.turn_start_time,
    state.turn_start_at,
    state.current_turn_start_time,
    state.current_turn_start,
    state.current_turn_start_at,
  ];

  for (const candidate of candidates) {
    const parsed = parseTimestampToMs(candidate, nowMs);
    if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

export const getGamesList = async (_req, res, next) => {
  try {
    const list = await gameService.getGamesList();
    res.json(list);
  } catch (err) {
    next(err);
  }
};

export const getGameState = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    if (userId) {
      const player = await gameService.getPlayerForGame(id, userId);
      const playerId = player?.player_id ?? player?.playerId;
      if (playerId) {
        await touchPresence(id, playerId);
      }
    }
    const serverNow = await gameService.getServerNowMs();
    clearOldAutoMarks(serverNow);
    let state = await gameService.getGameState(id);
    const connectionsForAuto = await getConnections(id);

    if (userId) {
      const autoStarted = await gameService.maybeAutoStartGameIfReady(id, userId);
      if (autoStarted) {
        state = await gameService.getGameState(id);
      }
    }

    const autoPlayed = await maybeAutoMove(id, state, connectionsForAuto, serverNow);
    if (autoPlayed) {
      state = await gameService.getGameState(id);
    }

    const playersWithPresence = Array.isArray(state?.players)
      ? state.players.map(p => {
          const playerId = Number(p?.playerId ?? p?.player_id);
          return {
            ...p,
            isConnected: Number.isFinite(playerId) ? connectionsForAuto.get(playerId) ?? false : false,
          };
        })
      : state?.players;

    const turnStartMs = getTurnStartMs(state, serverNow);
    const turnDurationMs = getTurnDurationMs(state);
    const turnEndsAt =
      typeof turnStartMs === 'number' && typeof turnDurationMs === 'number'
        ? turnStartMs + turnDurationMs
        : null;

    res.json({
      state: {
        ...state,
        players: playersWithPresence,
        serverNow,
        turnEndsAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createNewGame = async (req, res, next) => {
  try {
    const { maxSeatsCount, turnTime, gameName, seats, turnDuration, name, nickname } = req.body;
    const userId = req.userId;

    const resolvedSeats = maxSeatsCount ?? seats;
    const resolvedTurnTime = turnTime ?? turnDuration;
    const resolvedGameName = gameName ?? name;

    const result = await gameService.createNewGame(resolvedSeats, resolvedTurnTime, resolvedGameName, nickname, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getGameScores = async (req, res, next) => {
  try {
    const { id } = req.params;
    const scores = await gameService.getGameScores(id);
    res.json({ scores });
  } catch (err) {
    next(err);
  }
};

export const makeTurnRow = async (req, res, next) => {
  try {
    const { gameId, rowId } = req.body;
    const userId = req.userId;
    const result = await gameService.makeTurnRow(gameId, rowId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const startGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.startGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const deleteGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.deleteGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const pauseGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.pauseGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resumeGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.resumeGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resetGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.resetGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const joinGame = async (req, res, next) => {
  try {
    const { gameId, nickname } = req.body;
    const userId = req.userId;
    const result = await gameService.joinGame(gameId, userId, nickname);
    const error = result && typeof result === 'object' ? result.error : undefined;
    if (typeof error === 'string' && error.trim()) {
      return res.status(400).json({ error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const leaveGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.leaveGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getHostedGames = async (req, res, next) => {
  try {
    const userId = req.userId;
    const result = await gameService.getHostedGames(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const makeTurnCard = async (req, res, next) => {
  try {
    const { gameId, rowId } = req.body;
    const userId = req.userId;
    const result = await gameService.makeTurnCard(gameId, rowId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const chooseColors = async (req, res, next) => {
  try {
    const { colorIds, gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.chooseColors(gameId, colorIds, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createNewPlayer = async (req, res, next) => {
  try {
    const { gameId, nickname } = req.body;
    const userId = req.userId;
    const result = await gameService.createNewPlayer(gameId, userId, nickname);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const finishGame = async (req, res, next) => {
  try {
    const { gameId } = req.body;
    const userId = req.userId;
    const result = await gameService.finishGame(gameId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getCardInfo = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;
    const result = await gameService.getCardInfo(gameId, userId);
    const error = result && typeof result === 'object' ? result.error : undefined;
    if (typeof error === 'string' && error.trim()) {
      return res.status(400).json({ error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getPlayerForGame = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;
    const result = await gameService.getPlayerForGame(gameId, userId);
    if (!result || !result.player_id) {
      return res.json({ inGame: false });
    }
    res.json({
      inGame: true,
      player_id: result.player_id,
      nickname: result.nickname,
    });
  } catch (err) {
    next(err);
  }
};

export const setJokerColors = async (req, res, next) => {
  try {
    const { gameId, choices } = req.body;
    const userId = req.userId;
    const result = await gameService.setJokerColors(gameId, choices, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
