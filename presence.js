const PRESENCE_TIMEOUT_MS = Number(process.env.PRESENCE_TIMEOUT_MS || 30000);

const presenceMap = new Map();

export const touchPresence = (gameId, playerId) => {
  if (!gameId || !playerId) return;
  const id = String(gameId);
  const playerKey = String(playerId);
  const now = Date.now();
  if (!presenceMap.has(id)) {
    presenceMap.set(id, new Map());
  }
  presenceMap.get(id).set(playerKey, now);
};

export const getLastSeen = (gameId, playerId) => {
  const id = String(gameId);
  const playerKey = String(playerId);
  const gamePresence = presenceMap.get(id);
  if (!gamePresence) return null;
  const ts = gamePresence.get(playerKey);
  return typeof ts === 'number' ? ts : null;
};

export const getConnections = (gameId, timeoutMs) => {
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

export const getPresenceTimeout = () => PRESENCE_TIMEOUT_MS;

export default {
  touchPresence,
  getLastSeen,
  getConnections,
  getPresenceTimeout,
};
