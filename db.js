import pg from "pg";
import "dotenv/config";

// Support both Cloud Database (DATABASE_URL with SSL) and Local pgAdmin
const isCloudDb = !!process.env.DATABASE_URL;

const dbConfig = isCloudDb
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false }
    }
  : {
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_DATABASE || "secrets",
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 5432
    };

const db = new pg.Pool(dbConfig);

db.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

// Automatically ensure tables and OAuth columns exist
export async function initDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        google_id VARCHAR(255),
        github_id VARCHAR(255),
        avatar TEXT
      );

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        author VARCHAR(255) NOT NULL,
        image_url TEXT,
        video_url TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
    `);
    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Database initialization error:", err.message);
  }
}

export default db;
