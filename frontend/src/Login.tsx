import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { AVATARS } from './types';
import { getUserId } from './utils';
import './Login.css';

// Connect to backend
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
console.log('🔌 Backend URL:', BACKEND_URL);

// Create socket with explicit options
export const socket: Socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
});

// Debug socket connection
socket.on('connect', () => {
    console.log('✅ Socket connected! ID:', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message);
});

socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
});

function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
    const [error, setError] = useState('');
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [loading, setLoading] = useState(false);
    const [userChips, setUserChips] = useState<number | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const onConnect = () => {
            console.log('🎮 Socket ready!');
            setIsConnected(true);
        };
        const onDisconnect = () => {
            setIsConnected(false);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        if (!socket.connected) {
            socket.connect();
        }

        // Check if user is already logged in
        const token = localStorage.getItem('poker_token');
        if (token) {
            checkExistingToken(token);
        }

        const savedAvatar = localStorage.getItem('poker_avatar');
        if (savedAvatar) setSelectedAvatar(savedAvatar);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, []);

    const checkExistingToken = async (token: string) => {
        try {
            const res = await fetch(`${BACKEND_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsername(data.user.username);
                setUserChips(data.user.chips);
                localStorage.setItem('poker_username', data.user.username);
            } else {
                // Token invalid - clear everything
                localStorage.removeItem('poker_token');
                localStorage.removeItem('poker_username');
                setUserChips(null);
            }
        } catch (e) {
            console.error('Token check failed:', e);
            localStorage.removeItem('poker_token');
            setUserChips(null);
        }
    };

    const handleAuth = async () => {
        if (!username.trim()) {
            setError('Please enter your username');
            return;
        }
        if (!password.trim()) {
            setError('Please enter your password');
            return;
        }
        if (!isConnected) {
            setError('Not connected to server. Please wait...');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const res = await fetch(`${BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Authentication failed');
                setLoading(false);
                return;
            }

            // Save token and user info
            localStorage.setItem('poker_token', data.token);
            localStorage.setItem('poker_username', data.user.username);
            localStorage.setItem('poker_avatar', selectedAvatar);
            localStorage.setItem('poker_userId', String(data.user.id));
            getUserId(); // Ensure persistent ID

            setUserChips(data.user.chips);
            setLoading(false);

            // Navigate to lobby
            navigate('/lobby');
        } catch (e) {
            console.error('Auth error:', e);
            setError('Connection failed. Try again.');
            setLoading(false);
        }
    };

    const handleEnterLobby = () => {
        if (!localStorage.getItem('poker_token')) {
            setError('Please login or register first');
            return;
        }
        navigate('/lobby');
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="logo">♠️ Poker Elite ♦️</h1>
                <p className="tagline">Real-time Texas Hold'em</p>

                <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                    {isConnected ? '🟢 Connected' : '🔴 Connecting...'}
                </div>

                {userChips !== null && (
                    <div className="user-chips-display">
                        💰 Balance: ${userChips.toLocaleString()}
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}

                {/* Auth Mode Toggle */}
                <div className="auth-toggle">
                    <button
                        className={`auth-tab ${isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(true)}
                    >
                        Login
                    </button>
                    <button
                        className={`auth-tab ${!isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(false)}
                    >
                        Register
                    </button>
                </div>

                {!isLogin && (
                    <div className="avatar-selector">
                        <span className="selected-avatar">{selectedAvatar}</span>
                        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Choose your avatar</p>
                        <div className="avatar-grid">
                            {AVATARS.map(avatar => (
                                <div
                                    key={avatar}
                                    className={`avatar-option ${selectedAvatar === avatar ? 'selected' : ''}`}
                                    onClick={() => setSelectedAvatar(avatar)}
                                >
                                    {avatar}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field"
                    maxLength={20}
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    maxLength={50}
                    onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                />

                <button
                    className="btn primary full-width"
                    onClick={handleAuth}
                    disabled={!isConnected || loading}
                    style={{ marginTop: '20px' }}
                >
                    {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
                </button>

                {userChips !== null && (
                    <button
                        className="btn secondary full-width"
                        onClick={handleEnterLobby}
                        style={{ marginTop: '10px' }}
                    >
                        Enter Lobby
                    </button>
                )}
            </div>
        </div>
    );
}

export default Login;
