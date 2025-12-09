import * as gameService from './modules/game/service.js';
import { getPresenceTimeout } from './presence.js';

const autoHandled = new Map(); // gameId -> last turnStartMs
const AUTO_MOVE_TIMEOUT_MS = Number(process.env.AUTO_MOVE_TIMEOUT_MS || 20000);

const getAvailableRows = (rows = []) => rows.filter(row => Array.isArray(row.cards));

const pickRowForCard = (rows = []) => {
  const available = getAvailableRows(rows);
  if (!available.length) return null;
  const counts = available.map(r => (r.cards?.length ?? 0));
  const minCount = Math.min(...counts);
  const candidates = available.filter(r => (r.cards?.length ?? 0) === minCount);
  return candidates[0]?.rowId ?? null;
};

export const maybeAutoMove = async (gameId, state, connections) => {
  try {
    if (!state || !gameId) return false;
    const currentPlayer = state.players?.find(p => p.isCurrentTurn);
    if (!currentPlayer?.playerId) return false;

    const turnStartMs = state.currentTurnStartTime ? new Date(state.currentTurnStartTime).getTime() : 0;
    if (!turnStartMs) return false;

    const handledKey = `${gameId}:${turnStartMs}`;
    if (autoHandled.get(handledKey)) return false;

    const now = Date.now();
    const elapsed = now - turnStartMs;
    const turnDurationMs = state.turnDuration ? Number(state.turnDuration) * 1000 : null;
    const isConnected = connections?.get(currentPlayer.playerId);

    const timeoutTriggered =
      (turnDurationMs ? elapsed >= turnDurationMs : false) ||
      (!isConnected && elapsed >= AUTO_MOVE_TIMEOUT_MS);

    if (!timeoutTriggered) return false;

    const rows = state.rows ?? [];
    const availableRows = getAvailableRows(rows);

    if (availableRows.length === 0) {
      const rowId = rows[0]?.rowId;
      if (!rowId) return false;
      await gameService.makeTurnRow(currentPlayer.playerId, gameId, rowId);
    } else {
      const rowId = pickRowForCard(rows);
      if (!rowId) return false;
      await gameService.makeTurnCard(currentPlayer.playerId, gameId, rowId);
    }

    autoHandled.set(handledKey, true);
    return true;
  } catch (err) {
    console.error('Auto-move failed', err);
    return false;
  }
};

export const clearOldAutoMarks = () => {
  const timeout = Math.max(getPresenceTimeout(), AUTO_MOVE_TIMEOUT_MS);
  const now = Date.now();
  for (const key of autoHandled.keys()) {
    const [, ts] = key.split(':');
    const parsed = Number(ts);
    if (!parsed) continue;
    if (now - parsed > timeout * 2) {
      autoHandled.delete(key);
    }
  }
};

export default {
  maybeAutoMove,
  clearOldAutoMarks,
};
