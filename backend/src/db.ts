import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'poker.db');
const db: DatabaseType = new Database(dbPath);

// Create users table
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        chips INTEGER DEFAULT 10000,
        avatar TEXT DEFAULT '👤',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

console.log('📦 Database initialized at', dbPath);

export default db;
