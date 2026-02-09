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
        const existing = await db.get<{ id: number }>('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await db.run(
            'INSERT INTO users (username, password_hash, chips) VALUES (?, ?, ?)',
            [username, passwordHash, STARTING_CHIPS]
        );

        const token = jwt.sign({ userId: result.lastID, username }, JWT_SECRET, { expiresIn: '7d' });

        console.log(`✅ New user registered: ${username}`);

        res.json({
            token,
            user: {
                id: result.lastID,
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

        const user = await db.get<User>('SELECT * FROM users WHERE username = ?', [username]);
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
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };

        const user = await db.get<User>('SELECT id, username, chips, avatar FROM users WHERE id = ?', [decoded.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// Top up chips (admin or self)
router.post('/topup', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };

        const { amount } = req.body;
        if (!amount || amount <= 0 || amount > 100000) {
            return res.status(400).json({ error: 'Invalid amount (max 100000)' });
        }

        const user = await db.get<User>('SELECT chips FROM users WHERE id = ?', [decoded.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newBalance = user.chips + amount;
        await db.run('UPDATE users SET chips = ? WHERE id = ?', [newBalance, decoded.userId]);

        console.log(`💰 User ${decoded.username} topped up ${amount} chips (new balance: ${newBalance})`);

        res.json({ chips: newBalance });
    } catch (err) {
        console.error('Topup error:', err);
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// Update user chips (internal use)
export async function updateUserChips(userId: number, chips: number) {
    await db.run('UPDATE users SET chips = ? WHERE id = ?', [chips, userId]);
}

// Get user by ID
export async function getUserById(userId: number): Promise<User | undefined> {
    return await db.get<User>('SELECT * FROM users WHERE id = ?', [userId]);
}

export { JWT_SECRET };
export default router;
