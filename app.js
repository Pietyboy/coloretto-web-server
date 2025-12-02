import cors from 'cors';
import { config as loadEnv } from 'dotenv';
import express, { json } from 'express';
import { query } from './db.js';
import createSSHTunnel from './ssh.js';

loadEnv();

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors());
app.use(json());

app.get('/api/ping', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/games/list', async (_req, res) => {
  try {
    const { rows } = await query('SELECT "get_games_list"()');
    res.json(rows[0].get_games_list);
  } catch (error) {
    console.error('Error executing games list', error);
    res.status(500).json({ error: 'Failed to fetch games list' });
  }
});

app.post('/api/auth', async (req, res) =>  {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required', username: username, password: password });
    }

    const { rows } = await query(
      'SELECT "game_auth"($1, $2)',
      [username, password]
    );

    res.json(JSON.parse(rows[0].game_auth));
  } catch (error) {
    console.error('Error executing game_auth', error);
    res.status(500).json({ error: 'Failed to login' });
  }
})

app.get('/api/game/state/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('SELECT "get_game_state"($1)', [id]);
    res.json({state: rows[0].get_game_state});
  } catch (error) {
    console.error('Error executing game state', error);
    res.status(500).json({ error: 'Failed to fetch game state' });
  }
});

// Тест БД
app.get('/api/test-db', async (_req, res) => {
  try {
    const r = await query('SELECT NOW()');
    res.json({ now: r.rows[0].now });
  } catch (err) {
    console.error('DB test failed:', err);
    res.status(500).json({ error: err.message });
  }
});

createSSHTunnel()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Failed to start SSH tunnel. Server not started.", err);
    process.exit(1);
  });

