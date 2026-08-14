import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL?.trim();

// Hosted environments commonly provide one DATABASE_URL, while local
// development uses the individual DB_* variables from .env.
const pool = databaseUrl
  ? mysql.createPool(databaseUrl)
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'geetpay',
      waitForConnections: true,
      connectionLimit: process.env.VERCEL ? 3 : 10,
      queueLimit: 0,
      connectTimeout: 15000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

const TRANSIENT_DB_ERRORS = new Set(['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'EPIPE']);

export async function queryWithRetry<T = any>(sql: string, values: any[] = [], retries = 2): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await pool.query(sql, values) as T;
    } catch (error: any) {
      lastError = error;
      if (!TRANSIENT_DB_ERRORS.has(error?.code) || attempt === retries) throw error;
      console.warn(`Transient database connection error (${error.code}); retrying query ${attempt + 1}/${retries}...`);
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

// Test connection
pool.getConnection()
  .then((connection) => {
    console.log('Database connected successfully.');
    connection.release();
  })
  .catch((err: any) => {
    console.error('Error connecting to the database:', {
      code: err?.code || 'UNKNOWN_DB_ERROR',
      errno: err?.errno,
      message: err?.message || String(err),
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'geetpay',
    });
  });

export default pool;
