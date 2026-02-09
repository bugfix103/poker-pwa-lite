import { Pool } from 'pg';
import Database from 'better-sqlite3';
import path from 'path';

// Check if we have PostgreSQL connection string
const DATABASE_URL = process.env.DATABASE_URL;

let dbType: 'postgres' | 'sqlite';
let pgPool: Pool | null = null;
let sqliteDb: Database.Database | null = null;

if (DATABASE_URL) {
    // Use PostgreSQL
    dbType = 'postgres';
    pgPool = new Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    console.log('🐘 Using PostgreSQL database');
} else {
    // Fallback to SQLite for local development
    dbType = 'sqlite';
    const dbPath = path.join(__dirname, '..', 'poker.db');
    sqliteDb = new Database(dbPath);
    console.log('📦 Using SQLite database at', dbPath);
}

// Initialize tables
async function initDatabase() {
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            chips INTEGER DEFAULT 10000,
            avatar VARCHAR(50) DEFAULT '👤',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    if (dbType === 'postgres' && pgPool) {
        try {
            await pgPool.query(createUsersTable);
            console.log('✅ PostgreSQL tables initialized');
        } catch (err) {
            console.error('❌ Failed to initialize PostgreSQL:', err);
        }
    } else if (sqliteDb) {
        sqliteDb.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                chips INTEGER DEFAULT 10000,
                avatar TEXT DEFAULT '👤',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ SQLite tables initialized');
    }
}

// Database interface
export const db = {
    type: dbType,

    // Get a single row
    async get<T>(query: string, params: any[] = []): Promise<T | undefined> {
        if (dbType === 'postgres' && pgPool) {
            // Convert ? placeholders to $1, $2, etc for PostgreSQL
            const pgQuery = query.replace(/\?/g, (_, i) => `$${params.indexOf(_) + 1}`);
            let paramIndex = 0;
            const pgQueryFixed = query.replace(/\?/g, () => `$${++paramIndex}`);
            const result = await pgPool.query(pgQueryFixed, params);
            return result.rows[0] as T;
        } else if (sqliteDb) {
            return sqliteDb.prepare(query).get(...params) as T;
        }
        return undefined;
    },

    // Get all rows
    async all<T>(query: string, params: any[] = []): Promise<T[]> {
        if (dbType === 'postgres' && pgPool) {
            let paramIndex = 0;
            const pgQuery = query.replace(/\?/g, () => `$${++paramIndex}`);
            const result = await pgPool.query(pgQuery, params);
            return result.rows as T[];
        } else if (sqliteDb) {
            return sqliteDb.prepare(query).all(...params) as T[];
        }
        return [];
    },

    // Run a query (insert/update/delete)
    async run(query: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
        if (dbType === 'postgres' && pgPool) {
            let paramIndex = 0;
            let pgQuery = query.replace(/\?/g, () => `$${++paramIndex}`);

            // Handle INSERT with RETURNING for PostgreSQL
            if (query.trim().toUpperCase().startsWith('INSERT')) {
                pgQuery = pgQuery + ' RETURNING id';
                const result = await pgPool.query(pgQuery, params);
                return { lastID: result.rows[0]?.id || 0, changes: result.rowCount || 0 };
            }

            const result = await pgPool.query(pgQuery, params);
            return { lastID: 0, changes: result.rowCount || 0 };
        } else if (sqliteDb) {
            const stmt = sqliteDb.prepare(query);
            const result = stmt.run(...params);
            return { lastID: result.lastInsertRowid as number, changes: result.changes };
        }
        return { lastID: 0, changes: 0 };
    }
};

// Initialize on module load
initDatabase();

export default db;
