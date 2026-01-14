import { query } from './db.js';

const PRESENCE_TIMEOUT_MS = Number(process.env.PRESENCE_TIMEOUT_MS || 30000);
const PRESENCE_STORAGE = String(process.env.PRESENCE_STORAGE || 'auto').toLowerCase();

const presenceMap = new Map();

const PRESENCE_TABLE_NAME = 'game_player_presence';

let dbPermanentlyDisabled = false;
let dbUnavailableUntilMs = 0;

const shouldUseDbPresence = () => {
  if (dbPermanentlyDisabled) return false;
  if (Date.now() < dbUnavailableUntilMs) return false;
  return PRESENCE_STORAGE === 'db' || PRESENCE_STORAGE === 'auto';
};

const disableDbPresence = (err) => {
  const code = err?.code;

  if (code === '42P01') {
    dbPermanentlyDisabled = true;
    console.warn(
      `[presence] DB table "${PRESENCE_TABLE_NAME}" not found; falling back to in-memory presence. ` +
        `Create it or set PRESENCE_STORAGE=memory.`,
    );
    return;
  }

  dbUnavailableUntilMs = Date.now() + 60_000;
  console.warn('[presence] DB presence temporarily unavailable; falling back to in-memory presence.', err?.message ?? err);
};

const touchPresenceMemory = (gameId, playerId) => {
  if (!gameId || !playerId) return;
  const id = String(gameId);
  const playerKey = String(playerId);
  const now = Date.now();
  if (!presenceMap.has(id)) {
    presenceMap.set(id, new Map());
  }
  presenceMap.get(id).set(playerKey, now);
};

const getConnectionsMemory = (gameId, timeoutMs) => {
  const id = String(gameId);
  const gamePresence = presenceMap.get(id);
  if (!gamePresence) return new Map();
  const effectiveTimeoutMs = typeof timeoutMs === 'number' ? timeoutMs : PRESENCE_TIMEOUT_MS;
  const now = Date.now();
  const result = new Map();
  for (const [playerId, ts] of gamePresence.entries()) {
    if (now - ts <= effectiveTimeoutMs) {
      result.set(Number(playerId), true);
    }
  }
  return result;
};

export const touchPresence = async (gameId, playerId) => {
  touchPresenceMemory(gameId, playerId);

  if (!shouldUseDbPresence()) return;

  const normalizedGameId = Number(gameId);
  const normalizedPlayerId = Number(playerId);

  if (!Number.isFinite(normalizedGameId) || !Number.isFinite(normalizedPlayerId)) return;

  try {
    await query(
      `INSERT INTO ${PRESENCE_TABLE_NAME} (game_id, player_id, last_seen_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (game_id, player_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
      [normalizedGameId, normalizedPlayerId],
    );
  } catch (err) {
    disableDbPresence(err);
  }
};

export const getConnections = async (gameId, timeoutMs) => {
  const effectiveTimeoutMs = typeof timeoutMs === 'number' ? timeoutMs : PRESENCE_TIMEOUT_MS;

  if (!shouldUseDbPresence()) {
    return getConnectionsMemory(gameId, effectiveTimeoutMs);
  }

  const normalizedGameId = Number(gameId);
  if (!Number.isFinite(normalizedGameId)) return new Map();

  try {
    const { rows } = await query(
      `SELECT player_id
       FROM ${PRESENCE_TABLE_NAME}
       WHERE game_id = $1
         AND last_seen_at >= NOW() - ($2 * INTERVAL '1 millisecond')`,
      [normalizedGameId, effectiveTimeoutMs],
    );

    const result = new Map();
    for (const row of rows) {
      const playerId = Number(row?.player_id);
      if (Number.isFinite(playerId)) {
        result.set(playerId, true);
      }
    }
    return result;
  } catch (err) {
    disableDbPresence(err);
    return getConnectionsMemory(gameId, effectiveTimeoutMs);
  }
};

export const getLastSeen = (gameId, playerId) => {
  const id = String(gameId);
  const playerKey = String(playerId);
  const gamePresence = presenceMap.get(id);
  if (!gamePresence) return null;
  const ts = gamePresence.get(playerKey);
  return typeof ts === 'number' ? ts : null;
};

export const getPresenceTimeout = () => PRESENCE_TIMEOUT_MS;

export default {
  touchPresence,
  getConnections,
  getLastSeen,
  getPresenceTimeout,
};
