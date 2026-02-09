import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from './Login';
import { type RoomInfo, type RoomSettings, DEFAULT_SETTINGS, GAME_TYPE_LABELS } from './types';
import { getUserId } from './utils';
import './Lobby.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function Lobby() {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState<RoomInfo[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
    const [userBalance, setUserBalance] = useState<number | null>(null);

    const username = localStorage.getItem('poker_username');
    const avatar = localStorage.getItem('poker_avatar') || '👤';
    const token = localStorage.getItem('poker_token');

    // Fetch user balance
    const fetchBalance = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${BACKEND_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUserBalance(data.user.chips);
            }
        } catch (e) {
            console.error('Failed to fetch balance:', e);
        }
    };

    useEffect(() => {
        // Require both username and token
        if (!username || !token) {
            navigate('/');
            return;
        }

        // Fetch user balance
        fetchBalance();

        // Request room list
        socket.emit('get_rooms');

        // Listen for updates
        socket.on('room_list', (roomList: RoomInfo[]) => {
            setRooms(roomList);
        });

        socket.on('room_list_update', () => {
            socket.emit('get_rooms');
        });

        socket.on('room_created', ({ roomId }: { roomId: string }) => {
            localStorage.setItem('poker_room', roomId);
            const userAvatar = localStorage.getItem('poker_avatar') || '👤';
            const userId = getUserId();
            socket.emit('join_room', { roomId, name: username, avatar: userAvatar, userId });
            navigate('/table');
        });

        return () => {
            socket.off('room_list');
            socket.off('room_list_update');
            socket.off('room_created');
        };
    }, []);

    const handleCreateRoom = () => {
        const finalSettings = {
            ...settings,
            roomName: settings.roomName || `${username}'s Table`
        };
        const userAvatar = localStorage.getItem('poker_avatar') || '👤';
        const userId = getUserId();
        socket.emit('create_room', {
            name: username,
            avatar: userAvatar,
            settings: finalSettings,
            userId
        });
    };

    const handleJoinRoom = (roomId: string) => {
        localStorage.setItem('poker_room', roomId);
        const userAvatar = localStorage.getItem('poker_avatar') || '👤';
        const userId = getUserId();
        socket.emit('join_room', { roomId, name: username, avatar: userAvatar, userId });

        socket.once('player_joined', () => {
            navigate('/table');
        });

        socket.once('error', (err: { message: string }) => {
            alert(err.message);
        });
    };

    return (
        <div className="lobby-container">
            <header className="lobby-header">
                <div className="user-profile">
                    <div className="user-avatar">{avatar}</div>
                    <div className="user-info">
                        <h3>{username}</h3>
                        <div className="chip-balance">
                            Balance: ${userBalance !== null ? userBalance.toLocaleString() : '...'}
                        </div>
                    </div>
                </div>
                <div className="header-buttons">
                    <button className="btn topup" onClick={() => alert('💰 Top Up coming soon!')}>
                        💰 Top Up
                    </button>
                    <button className="btn secondary" onClick={() => {
                        localStorage.removeItem('poker_token');
                        localStorage.removeItem('poker_username');
                        navigate('/');
                    }}>Log Out</button>
                </div>
            </header>

            <div className="lobby-actions">
                <button className="btn primary" onClick={() => setShowCreateModal(true)}>
                    + Create Table
                </button>
                <div className="lobby-stats">
                    {rooms.length} Active Tables
                </div>
            </div>

            <div className="rooms-grid">
                {rooms.length === 0 ? (
                    <div className="no-rooms-placeholder">
                        <p>No active tables found.</p>
                        <p>Be the first to create one!</p>
                    </div>
                ) : (
                    rooms.map(room => (
                        <div key={room.id} className="room-card" onClick={() => handleJoinRoom(room.id)}>
                            <div className="room-header">
                                <span className="room-name">{room.name}</span>
                                <span className={`room-status ${room.phase}`}>
                                    {room.phase === 'waiting' ? 'Waiting' : 'Playing'}
                                </span>
                            </div>
                            <div className="room-details">
                                <div className="detail-item game-type-badge">
                                    <span>{room.gameType === 'omaha' ? '🎰' : '🃏'}</span>
                                    {GAME_TYPE_LABELS[room.gameType] || "Texas Hold'em"}
                                </div>
                                <div className="detail-item">
                                    <span>💰</span> ${room.buyIn} Buy-in
                                </div>
                                <div className="detail-item">
                                    <span>🎲</span> {room.blinds} Blinds
                                </div>
                            </div>
                            <div className="players-bar">
                                <div
                                    className="players-fill"
                                    style={{ width: `${(room.players / room.maxPlayers) * 100}%` }}
                                ></div>
                            </div>
                            <div className="detail-item" style={{ marginTop: '8px', justifyContent: 'space-between' }}>
                                <span>{room.players}/{room.maxPlayers} Players</span>
                                <span>ID: {room.id}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="create-room-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Create New Table</h2>
                            <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
                        </div>

                        <div className="form-group">
                            <label>Table Name</label>
                            <input
                                type="text"
                                placeholder={`${username}'s Table`}
                                value={settings.roomName}
                                onChange={e => setSettings({ ...settings, roomName: e.target.value })}
                                className="input-field"
                            />
                        </div>

                        <div className="form-group">
                            <label>Game Type</label>
                            <select
                                value={settings.gameType}
                                onChange={e => setSettings({ ...settings, gameType: e.target.value as 'holdem' | 'omaha' })}
                                className="input-field"
                            >
                                <option value="holdem">🃏 Texas Hold'em (2 cards)</option>
                                <option value="omaha">🎰 Omaha (4 cards)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Buy-in Amount</label>
                            <select
                                value={settings.buyIn}
                                onChange={e => setSettings({ ...settings, buyIn: Number(e.target.value) })}
                                className="input-field"
                            >
                                <option value={500}>$500 (Casual)</option>
                                <option value={1000}>$1,000 (Standard)</option>
                                <option value={5000}>$5,000 (High Roller)</option>
                                <option value={10000}>$10,000 (VIP)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Blinds (Small/Big)</label>
                            <select
                                value={settings.smallBlind}
                                onChange={e => setSettings({
                                    ...settings,
                                    smallBlind: Number(e.target.value),
                                    bigBlind: Number(e.target.value) * 2
                                })}
                                className="input-field"
                            >
                                <option value={5}>$5 / $10</option>
                                <option value={10}>$10 / $20</option>
                                <option value={25}>$25 / $50</option>
                                <option value={50}>$50 / $100</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Max Players: {settings.maxPlayers}</label>
                            <input
                                type="range"
                                min="2"
                                max="9"
                                value={settings.maxPlayers}
                                onChange={e => setSettings({ ...settings, maxPlayers: Number(e.target.value) })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <button className="btn primary full-width" onClick={handleCreateRoom}>
                            Create & Join
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Lobby;
