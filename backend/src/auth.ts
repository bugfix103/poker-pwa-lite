import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from './db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'poker-secret-key-change-in-production';
const SALT_ROUNDS = 10;
const STARTING_CHIPS = 10000;

interface User {
    id: number;
    username: string;
    password_hash: string;
    chips: number;
    avatar: string;
}

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Username must be 3-20 characters' });
        }

        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        // Check if user exists
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = db.prepare(
            'INSERT INTO users (username, password_hash, chips) VALUES (?, ?, ?)'
        ).run(username, passwordHash, STARTING_CHIPS);

        const token = jwt.sign({ userId: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });

        console.log(`✅ New user registered: ${username}`);

        res.json({
            token,
            user: {
                id: result.lastInsertRowid,
                username,
                chips: STARTING_CHIPS,
                avatar: '👤'
            }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

        console.log(`🔓 User logged in: ${username}`);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                chips: user.chips,
                avatar: user.avatar
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user (requires token)
router.get('/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };

        const user = db.prepare('SELECT id, username, chips, avatar FROM users WHERE id = ?').get(decoded.userId) as User | undefined;
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// Update user chips (internal use)
export function updateUserChips(userId: number, chips: number) {
    db.prepare('UPDATE users SET chips = ? WHERE id = ?').run(chips, userId);
}

// Get user by ID
export function getUserById(userId: number): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
}

export { JWT_SECRET };
export default router;
