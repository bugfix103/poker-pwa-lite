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
    const [name, setName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
    const [error, setError] = useState('');
    const [isConnected, setIsConnected] = useState(socket.connected);
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

        const savedName = localStorage.getItem('poker_username');
        if (savedName) setName(savedName);

        const savedAvatar = localStorage.getItem('poker_avatar');
        if (savedAvatar) setSelectedAvatar(savedAvatar);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, []);



    // ... (imports)

    const handleEnterLobby = () => {
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!isConnected) {
            setError('Not connected to server. Please wait...');
            return;
        }

        localStorage.setItem('poker_username', name);
        localStorage.setItem('poker_avatar', selectedAvatar);
        getUserId(); // Ensure ID is generated

        // Go to lobby instead of creating room directly
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

                {error && <div className="error-message">{error}</div>}

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

                <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                    maxLength={15}
                />

                <button
                    className="btn primary full-width"
                    onClick={handleEnterLobby}
                    disabled={!isConnected}
                    style={{ marginTop: '20px' }}
                >
                    Enter Lobby
                </button>
            </div>
        </div>
    );
}

export default Login;
