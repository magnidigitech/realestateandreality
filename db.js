import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:s9495js4byApkbGD7YybfNfz8N7ooQN1j71WPWGmtEsMinnPNRrAW1gjPLKGfpSO@i7r3iin36w0ssav57sn6tpc0:5432/postgres';

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

export default pool;
