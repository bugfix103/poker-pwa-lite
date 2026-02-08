import { useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import './Login.css';

// Connect to backend
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
export const socket = io(BACKEND_URL);

function Login() {
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [mode, setMode] = useState<'menu' | 'join'>('menu');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleCreateRoom = () => {
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }
        localStorage.setItem('poker_username', name);

        socket.emit('create_room', name);
        socket.once('room_created', ({ roomId }: { roomId: string }) => {
            localStorage.setItem('poker_room', roomId);
            socket.emit('join_room', { roomId, name });
            navigate('/table');
        });
    };

    const handleJoinRoom = () => {
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!roomCode.trim()) {
            setError('Please enter room code');
            return;
        }
        localStorage.setItem('poker_username', name);
        localStorage.setItem('poker_room', roomCode.toUpperCase());

        socket.emit('join_room', { roomId: roomCode.toUpperCase(), name });

        socket.once('error', ({ message }: { message: string }) => {
            setError(message);
        });

        socket.once('player_joined', () => {
            navigate('/table');
        });
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="logo">♠️ Poker Elite ♦️</h1>
                <p className="tagline">Real-time Texas Hold'em</p>

                {error && <div className="error-message">{error}</div>}

                <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                    maxLength={15}
                />

                {mode === 'menu' ? (
                    <div className="button-group">
                        <button className="btn primary" onClick={handleCreateRoom}>
                            🏠 Create Room
                        </button>
                        <button className="btn secondary" onClick={() => setMode('join')}>
                            🔗 Join Room
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            placeholder="Room Code (e.g., ABC123)"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            className="input-field"
                            maxLength={6}
                        />
                        <div className="button-group">
                            <button className="btn primary" onClick={handleJoinRoom}>
                                ▶️ Join Game
                            </button>
                            <button className="btn secondary" onClick={() => setMode('menu')}>
                                ← Back
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Login;
