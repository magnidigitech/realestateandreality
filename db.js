import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:s9495js4byApkbGD7YybfNfz8N7ooQN1j71WPWGmtEsMinnPNRrAW1gjPLKGfpSO@i7r3iin36w0ssav57sn6tpc0:5432/postgres';

// Determine SSL configuration.
// Local/internal Coolify DB networks do not require SSL and will fail if forced.
// External databases (like Supabase/Neon) requiring SSL can add ssl=true/sslmode=require to connectionString, or set DB_SSL=true.
let ssl = false;
if (process.env.DB_SSL === 'true' || connectionString.includes('sslmode=require') || connectionString.includes('ssl=true')) {
  ssl = { rejectUnauthorized: false };
}

const pool = new pg.Pool({
  connectionString,
  ssl
});

export default pool;
