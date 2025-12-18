import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';

loadEnv();

export const pool = new Pool({
  host: '127.0.0.1',
  port: Number(process.env.LOCAL_TUNNEL_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('error', err => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export const query = (text, params) => pool.query(text, params);

export default {
  query,
  pool,
};
