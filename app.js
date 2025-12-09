import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config as loadEnv } from 'dotenv';
import express from 'express';
import { query } from './db.js';
import authMiddleware from './middlewares/authMiddleware.js';
import errorHandler from './middlewares/errorHandler.js';
import authRouter from './modules/auth/index.js';
import gameRouter from './modules/game/index.js';
import userRouter from './modules/user/index.js';
import createSSHTunnel from './ssh.js';

loadEnv();

const PORT = process.env.PORT || 3000;
const app = express();

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : ['http://localhost:3000'];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

app.get('/api/ping', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/user', authRouter);
app.use('/api/user', userRouter);
app.use('/api/game', authMiddleware, gameRouter);

app.get('/api/test-db', async (_req, res, next) => {
  try {
    const r = await query('SELECT NOW()');
    res.json({ now: r.rows[0].now });
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);

createSSHTunnel()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start SSH tunnel. Server not started.', err);
    process.exit(1);
  });
