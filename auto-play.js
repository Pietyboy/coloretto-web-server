import { fetchChooseColors, fetchChooseJokerColors, fetchMakeTurnCard, fetchMakeTurnRow } from './modules/game/model.js';

const DEFAULT_AUTO_MOVE_TIMEOUT_MS = 20_000;
const DEFAULT_AUTO_MOVE_CLEANUP_TTL_MS = 60 * 60 * 1000;

const AUTO_MOVE_DEBUG =
  ['1', 'true', 'yes', 'on'].includes(String(process.env.AUTO_MOVE_DEBUG ?? '').trim().toLowerCase());

const debugAutoMove = (message, payload) => {
  if (!AUTO_MOVE_DEBUG) return;
  if (payload !== undefined) {
    console.log('[auto-move]', message, payload);
    return;
  }
  console.log('[auto-move]', message);
};

const parseEnvDurationMs = (value, fallbackMs) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value !== 'string') return fallbackMs;

  const raw = value.trim();
  if (!raw) return fallbackMs;

  const normalized = raw.replace(/_/g, '').toLowerCase();
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(ms|s|m|h)?$/);

  if (!match) {
    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber) && asNumber > 0) return Math.floor(asNumber);
    return fallbackMs;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;

  const unit = match[2] ?? 'ms';
  if (unit === 'ms') return Math.floor(amount);
  if (unit === 's') return Math.floor(amount * 1000);
  if (unit === 'm') return Math.floor(amount * 60_000);
  if (unit === 'h') return Math.floor(amount * 3_600_000);

  return fallbackMs;
};

const AUTO_MOVE_TIMEOUT_MS = parseEnvDurationMs(process.env.AUTO_MOVE_TIMEOUT_MS, DEFAULT_AUTO_MOVE_TIMEOUT_MS);
const AUTO_MOVE_CLEANUP_TTL_MS = parseEnvDurationMs(process.env.AUTO_MOVE_CLEANUP_TTL_MS, DEFAULT_AUTO_MOVE_CLEANUP_TTL_MS);
const TURN_START_TIMEZONE_OFFSET_MINUTES = (() => {
  const raw = process.env.TURN_START_TIMEZONE_OFFSET_MINUTES;
  if (raw === undefined) return -180;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : -180;
})();
const TURN_START_HAS_TZ_RE = /([zZ]|[+-]\d{2}:?\d{2})$/;
const TURN_START_NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
const TURN_START_TZ_HOURS_ONLY_RE = /[+-]\d{2}$/;
const TURN_START_PARTS_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(?:([zZ])|([+-])(\d{2})(?::?(\d{2}))?)?$/;

const normalizeTurnStartString = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (TURN_START_TZ_HOURS_ONLY_RE.test(trimmed)) {
    return `${trimmed}:00`;
  }

  return trimmed;
};

const pickBestNaiveTurnStartMs = (utcCandidate, offsetCandidate) => {
  if (!Number.isFinite(utcCandidate) && !Number.isFinite(offsetCandidate)) return 0;
  if (!Number.isFinite(utcCandidate)) return offsetCandidate;
  if (!Number.isFinite(offsetCandidate)) return utcCandidate;

  const now = Date.now();
  const utcSkewMs = utcCandidate - now;
  const offsetSkewMs = offsetCandidate - now;
  const futureToleranceMs = 60_000;

  const utcTooFuture = utcSkewMs > futureToleranceMs;
  const offsetTooFuture = offsetSkewMs > futureToleranceMs;

  if (utcTooFuture && !offsetTooFuture) return offsetCandidate;
  if (!utcTooFuture && offsetTooFuture) return utcCandidate;

  return Math.abs(offsetSkewMs) < Math.abs(utcSkewMs) ? offsetCandidate : utcCandidate;
};

const parseTurnStartStringToMs = (value) => {
  const match = value.match(TURN_START_PARTS_RE);
  if (!match) return 0;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] !== undefined ? Number(match[6]) : 0;
  const fraction = match[7];

  if (
    !Number.isFinite(year)
    || !Number.isFinite(month)
    || !Number.isFinite(day)
    || !Number.isFinite(hour)
    || !Number.isFinite(minute)
    || !Number.isFinite(second)
  ) {
    return 0;
  }

  const ms = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) : 0;
  const utcBase = Date.UTC(year, month - 1, day, hour, minute, second, Number.isFinite(ms) ? ms : 0);

  if (!Number.isFinite(utcBase)) return 0;

  if (match[8]) {
    return utcBase;
  }

  const sign = match[9];
  if (sign) {
    const tzHours = Number(match[10]);
    const tzMinutes = match[11] !== undefined ? Number(match[11]) : 0;
    if (!Number.isFinite(tzHours) || !Number.isFinite(tzMinutes)) return 0;

    const totalMinutes = tzHours * 60 + tzMinutes;
    const offsetMinutes = sign === '-' ? -totalMinutes : totalMinutes;
    return utcBase - offsetMinutes * 60_000;
  }

  if (!Number.isFinite(TURN_START_TIMEZONE_OFFSET_MINUTES)) return utcBase;

  const offsetMinutesFromUtc = -TURN_START_TIMEZONE_OFFSET_MINUTES;
  const offsetCandidate = utcBase - offsetMinutesFromUtc * 60_000;
  return pickBestNaiveTurnStartMs(utcBase, offsetCandidate);
};

const autoHandled = new Map(); // handledKey -> handledAtMs
const pauseByTurn = new Map(); // handledKey -> { pausedAtMs: number | null, pausedTotalMs: number, updatedAtMs: number }
const jokerAutoHandled = new Map(); // handledKey -> handledAtMs
const scoreAutoHandled = new Map(); // handledKey -> handledAtMs
const turnStartFallbackByGame = new Map(); // gameId -> { turnKey: string, startedAtMs: number, updatedAtMs: number }

const getUiGameStatus = (state) => {
  if (!state || typeof state !== 'object') return 'unknown';

  const candidate = state.gameStatus ?? state.status ?? state.game_status;

  if (typeof candidate === 'string') {
    const normalized = candidate.toLowerCase();
    if (normalized.includes('wait')) return 'waiting';
    if (normalized.includes('pause')) return 'paused';
    if (normalized.includes('finish')) return 'finished';
    if (
      normalized.includes('active')
      || normalized.includes('progress')
      || normalized.includes('in_progress')
      || normalized.includes('inprogress')
    ) {
      return 'active';
    }
  }

  if (state.isGameFinished === true || state.isFinished === true) return 'finished';

  return 'unknown';
};

const getRowCards = (row) => (Array.isArray(row?.cards) ? row.cards : []);

const getActiveRows = (rows = []) => rows.filter(row => row?.isActive !== false);

const getDroppableRows = (rows = []) => getActiveRows(rows).filter(row => getRowCards(row).length < 3);

const isDeckEmpty = (state) => {
  const remainingCardsCountRaw =
    state.remainingCardsCount
    ?? state.remaining_cards_count
    ?? state.remainingCards
    ?? state.remaining_cards;

  const remainingCardsCount = Number(remainingCardsCountRaw);
  if (Number.isFinite(remainingCardsCount)) return remainingCardsCount <= 0;

  const topCardId = state.firstDeckCard?.cardId ?? state.first_deck_card?.card_id;
  return !topCardId;
};

const getTopCardId = (state) => {
  const raw =
    state?.firstDeckCard?.cardId
    ?? state?.first_deck_card?.card_id
    ?? state?.topCardId
    ?? state?.top_card_id;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : null;
};

const areAllRowsCollected = (state) => {
  const rows = Array.isArray(state?.rows) ? state.rows : [];
  return rows.length > 0 && getActiveRows(rows).length === 0;
};

const isFinalStage = (state) => isDeckEmpty(state) && areAllRowsCollected(state);

const JOKER_AUTO_COLOR_ORDER = ['Green', 'Yellow', 'Brown', 'Pink', 'Red', 'Blue', 'Orange'];
const JOKER_AUTO_COLOR_BY_LOWER = new Map(JOKER_AUTO_COLOR_ORDER.map(color => [color.toLowerCase(), color]));
const COLOR_ID_BY_NAME = new Map(JOKER_AUTO_COLOR_ORDER.map((color, idx) => [color, idx + 1]));

const normalizeDbColor = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  if (normalized === 'none') return null;
  return JOKER_AUTO_COLOR_BY_LOWER.get(normalized) ?? null;
};

const pickMostFrequentColor = (hand = []) => {
  const counts = new Map();

  for (const card of hand) {
    const type = typeof card?.type === 'string' ? card.type.toLowerCase() : '';
    if (type !== 'common' && type !== 'joker') continue;

    const color = normalizeDbColor(card?.color);
    if (!color) continue;

    counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  let bestColor = JOKER_AUTO_COLOR_ORDER[0];
  let bestCount = -1;

  for (const color of JOKER_AUTO_COLOR_ORDER) {
    const count = counts.get(color) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestColor = color;
    }
  }

  return bestColor;
};

const pickTop3ColorIds = (hand = []) => {
  const counts = new Map();

  for (const card of hand) {
    const type = typeof card?.type === 'string' ? card.type.toLowerCase() : '';
    if (type !== 'common' && type !== 'joker') continue;

    const color = normalizeDbColor(card?.color);
    if (!color) continue;

    counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  const ranked = JOKER_AUTO_COLOR_ORDER
    .map((color, orderIndex) => ({
      color,
      count: counts.get(color) ?? 0,
      orderIndex,
    }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.orderIndex - b.orderIndex;
    })
    .slice(0, 3)
    .map(item => COLOR_ID_BY_NAME.get(item.color))
    .filter(colorId => Number.isFinite(colorId));

  return ranked;
};

const getCardId = (card) => {
  const raw = card?.cardId ?? card?.card_id;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : null;
};

const getUncoloredJokers = (hand = []) =>
  hand.filter(card => typeof card?.type === 'string'
    && card.type.toLowerCase() === 'joker'
    && typeof card?.color === 'string'
    && card.color.toLowerCase() === 'none');

const pickRowForCard = (rows = []) => {
  const droppable = getDroppableRows(rows);
  if (!droppable.length) return null;

  const sorted = droppable.slice().sort((a, b) => {
    const aCount = getRowCards(a).length;
    const bCount = getRowCards(b).length;
    if (aCount !== bCount) return aCount - bCount;
    return a.rowId - b.rowId;
  });

  return sorted[0]?.rowId ?? null;
};

const pickRowToTake = (rows = []) => {
  const takeable = getActiveRows(rows).filter(row => getRowCards(row).length > 0);
  if (!takeable.length) return null;

  const sorted = takeable.slice().sort((a, b) => {
    const aCount = getRowCards(a).length;
    const bCount = getRowCards(b).length;
    if (aCount !== bCount) return aCount - bCount;
    return a.rowId - b.rowId;
  });

  return sorted[0]?.rowId ?? null;
};

const pickRowToTakeMostCards = (rows = []) => {
  const takeable = getActiveRows(rows).filter(row => getRowCards(row).length > 0);
  if (!takeable.length) return null;

  const sorted = takeable.slice().sort((a, b) => {
    const aCount = getRowCards(a).length;
    const bCount = getRowCards(b).length;
    if (aCount !== bCount) return bCount - aCount;
    return a.rowId - b.rowId;
  });

  return sorted[0]?.rowId ?? null;
};

const normalizeTurnStartMs = (value) => {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(ms) ? ms : 0;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      const ms = asNumber < 1e12 ? asNumber * 1000 : asNumber;
      return Number.isFinite(ms) ? ms : 0;
    }
    const normalized = normalizeTurnStartString(trimmed);
    const parsed = new Date(normalized).getTime();
    if (!Number.isFinite(parsed)) {
      const fallbackParsed = parseTurnStartStringToMs(normalized);
      return Number.isFinite(fallbackParsed) ? fallbackParsed : 0;
    }

    const hasTimezone = TURN_START_HAS_TZ_RE.test(normalized);
    const isNaiveDateTime = TURN_START_NAIVE_DATETIME_RE.test(normalized);

    if (isNaiveDateTime && !hasTimezone && Number.isFinite(TURN_START_TIMEZONE_OFFSET_MINUTES)) {
      const serverOffsetMinutes = new Date(parsed).getTimezoneOffset();
      const shiftMs = (TURN_START_TIMEZONE_OFFSET_MINUTES - serverOffsetMinutes) * 60_000;
      const shifted = parsed + shiftMs;
      const now = Date.now();
      const parsedSkewMs = parsed - now;
      const shiftedSkewMs = shifted - now;
      const futureToleranceMs = 60_000;

      const parsedTooFuture = parsedSkewMs > futureToleranceMs;
      const shiftedTooFuture = shiftedSkewMs > futureToleranceMs;

      if (parsedTooFuture && !shiftedTooFuture) return shifted;
      if (!parsedTooFuture && shiftedTooFuture) return parsed;

      return Math.abs(shiftedSkewMs) < Math.abs(parsedSkewMs) ? shifted : parsed;
    }

    return parsed;
  }

  return 0;
};

const getTurnDurationMs = (state) => {
  if (!state || typeof state !== 'object') return null;

  const durationSecRaw =
    state.turnDuration
    ?? state.turn_duration
    ?? state.turnDurationSeconds
    ?? state.turn_duration_seconds;

  const durationSec = Number(durationSecRaw);
  if (Number.isFinite(durationSec) && durationSec > 0) return Math.floor(durationSec * 1000);

  const durationMsRaw =
    state.turnDurationMs
    ?? state.turn_duration_ms;

  const durationMs = Number(durationMsRaw);
  if (Number.isFinite(durationMs) && durationMs > 0) return Math.floor(durationMs);

  return null;
};

const getTurnStartMs = (state) => {
  if (!state || typeof state !== 'object') return 0;

  const stateRecord = state;
  const candidates = [
    stateRecord.currentTurnStartTime,
    stateRecord.turnStartTime,
    stateRecord.turnStart,
    stateRecord.turn_start,
    stateRecord.turn_start_time,
    stateRecord.turn_start_at,
    stateRecord.current_turn_start_time,
    stateRecord.current_turn_start,
    stateRecord.current_turn_start_at,
  ];

  const candidate = candidates.find(value => value !== null && value !== undefined && value !== '');
  return normalizeTurnStartMs(candidate);
};

const getTurnKey = (currentPlayer, state) => {
  const playerId = Number(currentPlayer?.playerId ?? currentPlayer?.player_id);
  if (!Number.isFinite(playerId) || playerId <= 0) return null;

  const turnNumberRaw =
    currentPlayer?.turnNumber
    ?? currentPlayer?.turn_number
    ?? state?.currentTurnNumber
    ?? state?.current_turn_number
    ?? state?.turnNumber
    ?? state?.turn_number;

  const turnNumber = Number(turnNumberRaw);
  const suffix = Number.isFinite(turnNumber) ? String(turnNumber) : 'unknown';
  return `${playerId}:${suffix}`;
};

const getApiError = (result) => {
  if (!result || typeof result !== 'object') return null;
  const error = result.error;
  if (typeof error !== 'string') return null;
  const trimmed = error.trim();
  return trimmed ? trimmed : null;
};

const getFallbackTurnStartMs = (gameId, currentPlayer, state) => {
  const turnKey = getTurnKey(currentPlayer, state);
  if (!turnKey) return 0;

  const now = Date.now();
  const existing = turnStartFallbackByGame.get(gameId);
  if (!existing || existing.turnKey !== turnKey) {
    turnStartFallbackByGame.set(gameId, { turnKey, startedAtMs: now, updatedAtMs: now });
    return now;
  }

  existing.updatedAtMs = now;
  return existing.startedAtMs;
};

const markPaused = (handledKey) => {
  if (!pauseByTurn.has(handledKey)) {
    pauseByTurn.set(handledKey, { pausedAtMs: null, pausedTotalMs: 0, updatedAtMs: 0 });
  }
  const pauseState = pauseByTurn.get(handledKey);
  const now = Date.now();
  pauseState.updatedAtMs = now;
  if (pauseState.pausedAtMs === null) {
    pauseState.pausedAtMs = now;
  }
};

const markResumed = (handledKey) => {
  const pauseState = pauseByTurn.get(handledKey);
  if (!pauseState) return;
  const now = Date.now();
  pauseState.updatedAtMs = now;
  if (pauseState.pausedAtMs === null) return;
  pauseState.pausedTotalMs += Math.max(0, now - pauseState.pausedAtMs);
  pauseState.pausedAtMs = null;
};

const autoChooseJokerColors = async (gameId, state, connections) => {
  if (!state || !gameId) return false;
  if (!isFinalStage(state)) return false;

  const players = Array.isArray(state.players) ? state.players : [];
  if (!players.length) return false;

  let changed = false;

  for (const player of players) {
    const playerId = Number(player?.playerId ?? player?.player_id);
    if (!Number.isFinite(playerId) || playerId <= 0) continue;

    const handledKey = `${gameId}:${playerId}`;
    if (jokerAutoHandled.has(handledKey)) continue;

    const isConnected = connections?.get(playerId) ?? false;
    if (isConnected) continue;

    const hand = Array.isArray(player?.hand) ? player.hand : [];
    const jokers = getUncoloredJokers(hand);
    if (!jokers.length) continue;

    const chosenColor = pickMostFrequentColor(hand);
    const choices = jokers
      .map(card => ({ card_id: getCardId(card), color: chosenColor }))
      .filter(choice => Number.isFinite(choice.card_id));

    if (!choices.length) continue;

    try {
      const result = await fetchChooseJokerColors(gameId, playerId, choices);
      const error = result && typeof result === 'object' ? result.error : undefined;

      if (typeof error === 'string' && error.trim()) {
        const normalized = error.toLowerCase();
        if (normalized.includes('уже выбран')) {
          jokerAutoHandled.set(handledKey, Date.now());
        } else {
          console.warn('Auto-joker-color selection failed', { error, gameId, playerId });
        }
        continue;
      }

      jokerAutoHandled.set(handledKey, Date.now());
      changed = true;
    } catch (err) {
      console.error('Auto-joker-color selection failed', err);
    }
  }

  return changed;
};

const autoChooseScoreColors = async (gameId, state, connections) => {
  if (!state || !gameId) return false;
  if (!isFinalStage(state)) return false;

  const players = Array.isArray(state.players) ? state.players : [];
  if (!players.length) return false;

  const allPlayersHaveColoredJokers = players.every(player => {
    const hand = Array.isArray(player?.hand) ? player.hand : [];
    return getUncoloredJokers(hand).length === 0;
  });

  if (!allPlayersHaveColoredJokers) return false;

  let changed = false;

  for (const player of players) {
    const playerId = Number(player?.playerId ?? player?.player_id);
    if (!Number.isFinite(playerId) || playerId <= 0) continue;

    const handledKey = `${gameId}:${playerId}`;
    if (scoreAutoHandled.has(handledKey)) continue;

    const isConnected = connections?.get(playerId) ?? false;
    if (isConnected) continue;

    const selectedColors = Array.isArray(player?.colors) ? player.colors : [];
    if (selectedColors.length === 3) continue;

    const hand = Array.isArray(player?.hand) ? player.hand : [];
    const colorIds = pickTop3ColorIds(hand);
    if (colorIds.length !== 3) continue;

    try {
      const result = await fetchChooseColors(playerId, colorIds);
      const error = result && typeof result === 'object' ? result.error : undefined;

      if (typeof error === 'string' && error.trim()) {
        const normalized = error.toLowerCase();
        if (normalized.includes('уже выбран') || normalized.includes('уже выбраны')) {
          scoreAutoHandled.set(handledKey, Date.now());
        } else {
          console.warn('Auto-score-color selection failed', { error, gameId, playerId });
        }
        continue;
      }

      scoreAutoHandled.set(handledKey, Date.now());
      changed = true;
    } catch (err) {
      console.error('Auto-score-color selection failed', err);
    }
  }

  return changed;
};

export const maybeAutoMove = async (gameId, state, connections) => {
  try {
    if (!state || !gameId) return false;

    const gameStatus = getUiGameStatus(state);
    debugAutoMove('Tick', { gameId, gameStatus });
    if (gameStatus === 'waiting' || gameStatus === 'unknown') return false;
    if (gameStatus === 'finished') {
      const jokersAutoPlayed = await autoChooseJokerColors(gameId, state, connections);
      if (jokersAutoPlayed) return true;

      return await autoChooseScoreColors(gameId, state, connections);
    }

    const currentPlayer = Array.isArray(state.players)
      ? state.players.find(p => p.isCurrentTurn || p.is_current_turn)
      : null;
    const currentPlayerId = Number(currentPlayer?.playerId ?? currentPlayer?.player_id);
    if (!Number.isFinite(currentPlayerId) || currentPlayerId <= 0) {
      debugAutoMove('Skip: no current player', { gameId });
      return false;
    }

    let turnStartMs = getTurnStartMs(state);
    if (!turnStartMs) {
      debugAutoMove('Missing turn_start; using fallback', { gameId, currentPlayerId });
      turnStartMs = getFallbackTurnStartMs(gameId, currentPlayer, state);
    }
    if (!turnStartMs) {
      debugAutoMove('Skip: no turn_start available', { gameId, currentPlayerId });
      return false;
    }

    const handledKey = `${gameId}:${turnStartMs}`;
    if (autoHandled.has(handledKey)) return false;

    if (gameStatus === 'paused') {
      markPaused(handledKey);
      return false;
    }

    if (gameStatus !== 'active') return false;

    markResumed(handledKey);

    const now = Date.now();
    const pausedTotalMs = pauseByTurn.get(handledKey)?.pausedTotalMs ?? 0;
    const elapsed = Math.max(0, now - turnStartMs - pausedTotalMs);
    const turnDurationMs = getTurnDurationMs(state);
    const isConnected = connections?.get(currentPlayerId) ?? false;
    const fullTimeoutMs = turnDurationMs ?? AUTO_MOVE_TIMEOUT_MS;
    const autoMoveTimeoutMs = turnDurationMs ? Math.floor(turnDurationMs / 2) : AUTO_MOVE_TIMEOUT_MS;
    const timeoutTriggered = elapsed >= fullTimeoutMs || (!isConnected && elapsed >= autoMoveTimeoutMs);

    if (!Number.isFinite(fullTimeoutMs) || fullTimeoutMs <= 0) {
      debugAutoMove('Invalid timeout config', {
        gameId,
        currentPlayerId,
        turnStartMs,
        elapsed,
        turnDurationMs,
        fullTimeoutMs,
        autoMoveTimeoutMs,
        isConnected,
        AUTO_MOVE_TIMEOUT_MS,
      });
    }

    if (AUTO_MOVE_DEBUG && elapsed > 0 && elapsed % 10_000 < 1_000) {
      debugAutoMove('Progress', {
        gameId,
        currentPlayerId,
        elapsed,
        fullTimeoutMs,
        autoMoveTimeoutMs,
        isConnected,
      });
    }

    if (!timeoutTriggered) return false;

    debugAutoMove('Triggered', {
      gameId,
      currentPlayerId,
      elapsed,
      fullTimeoutMs,
      autoMoveTimeoutMs,
      isConnected,
    });

    const rows = Array.isArray(state.rows) ? state.rows : [];

    autoHandled.set(handledKey, Date.now());
    try {
      if (isDeckEmpty(state)) {
        const rowIdToTake = pickRowToTakeMostCards(rows);
        if (!rowIdToTake) {
          autoHandled.delete(handledKey);
          return false;
        }
        const result = await fetchMakeTurnRow(currentPlayerId, gameId, rowIdToTake);
        const error = getApiError(result);
        if (error) {
          autoHandled.delete(handledKey);
          debugAutoMove('Failed: take row', { error, gameId, playerId: currentPlayerId, rowId: rowIdToTake });
          console.warn('Auto-move failed to take row', { error, gameId, playerId: currentPlayerId, rowId: rowIdToTake });
          return false;
        }
        return true;
      }

      const rowIdForCard = pickRowForCard(rows);
      if (rowIdForCard) {
        const topCardId = getTopCardId(state);
        if (!topCardId) {
          autoHandled.delete(handledKey);
          return false;
        }
        const result = await fetchMakeTurnCard(currentPlayerId, gameId, rowIdForCard, topCardId);
        const error = getApiError(result);
        if (error) {
          const fallbackResult = await fetchMakeTurnCard(currentPlayerId, gameId, rowIdForCard);
          const fallbackError = getApiError(fallbackResult);

          if (fallbackError) {
            autoHandled.delete(handledKey);
            debugAutoMove('Failed: place card', {
              error,
              fallbackError,
              gameId,
              playerId: currentPlayerId,
              rowId: rowIdForCard,
              cardId: topCardId,
            });
            console.warn('Auto-move failed to place card', {
              error,
              fallbackError,
              gameId,
              playerId: currentPlayerId,
              rowId: rowIdForCard,
              cardId: topCardId,
            });
            return false;
          }
        }
        return true;
      }

      const rowIdToTake = pickRowToTake(rows);
      if (!rowIdToTake) {
        autoHandled.delete(handledKey);
        return false;
      }
      const result = await fetchMakeTurnRow(currentPlayerId, gameId, rowIdToTake);
      const error = getApiError(result);
      if (error) {
        autoHandled.delete(handledKey);
        debugAutoMove('Failed: take row', { error, gameId, playerId: currentPlayerId, rowId: rowIdToTake });
        console.warn('Auto-move failed to take row', { error, gameId, playerId: currentPlayerId, rowId: rowIdToTake });
        return false;
      }
      return true;
    } catch (err) {
      autoHandled.delete(handledKey);
      throw err;
    }
  } catch (err) {
    console.error('Auto-move failed', err);
    return false;
  }
};

export const maybeAutoChooseJokerColors = autoChooseJokerColors;

export const clearOldAutoMarks = () => {
  const now = Date.now();

  for (const [key, handledAtMs] of autoHandled.entries()) {
    if (typeof handledAtMs !== 'number') continue;
    if (now - handledAtMs > AUTO_MOVE_CLEANUP_TTL_MS) {
      autoHandled.delete(key);
    }
  }

  for (const [key, pauseState] of pauseByTurn.entries()) {
    const updatedAtMs = pauseState?.updatedAtMs;
    if (typeof updatedAtMs !== 'number') continue;
    if (now - updatedAtMs > AUTO_MOVE_CLEANUP_TTL_MS) {
      pauseByTurn.delete(key);
    }
  }

  for (const [key, handledAtMs] of jokerAutoHandled.entries()) {
    if (typeof handledAtMs !== 'number') continue;
    if (now - handledAtMs > AUTO_MOVE_CLEANUP_TTL_MS) {
      jokerAutoHandled.delete(key);
    }
  }

  for (const [gameId, fallback] of turnStartFallbackByGame.entries()) {
    const updatedAtMs = fallback?.updatedAtMs;
    if (typeof updatedAtMs !== 'number') continue;
    if (now - updatedAtMs > AUTO_MOVE_CLEANUP_TTL_MS) {
      turnStartFallbackByGame.delete(gameId);
    }
  }

  for (const [key, handledAtMs] of scoreAutoHandled.entries()) {
    if (typeof handledAtMs !== 'number') continue;
    if (now - handledAtMs > AUTO_MOVE_CLEANUP_TTL_MS) {
      scoreAutoHandled.delete(key);
    }
  }
};

export default {
  maybeAutoMove,
  maybeAutoChooseJokerColors,
  clearOldAutoMarks,
};
