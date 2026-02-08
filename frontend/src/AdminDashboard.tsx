import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Lobby.css';

interface ServerStats {
    uptime: number;
    memory: any;
    rooms: number;
    totalPlayers: number;
    activeRooms: Array<{
        id: string;
        name: string;
        players: number;
        phase: string;
        pot: number;
    }>;
}

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<ServerStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const fetchStats = async () => {
        const secret = localStorage.getItem('adminSecret');
        if (!secret) {
            navigate('/admin');
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/admin/stats`, {
                headers: {
                    'Authorization': secret
                }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    localStorage.removeItem('adminSecret');
                    navigate('/admin');
                    return;
                }
                throw new Error('Failed to fetch stats');
            }

            const data = await response.json();
            setStats(data);
            setLoading(false);
        } catch (err) {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            setError(`Failed to connect to server at ${backendUrl}`);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const deleteRoom = async (roomId: string) => {
        if (!confirm(`Are you sure you want to delete room ${roomId}?`)) return;

        const secret = localStorage.getItem('adminSecret');
        try {
            await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/admin/rooms/${roomId}`, {
                method: 'DELETE',
                headers: { 'Authorization': secret! }
            });
            fetchStats();
        } catch (err) {
            alert('Failed to delete room');
        }
    };

    const resetServer = async () => {
        if (!confirm('⚠️ WARNING: This will delete ALL rooms and kick ALL players. Continue?')) return;

        const secret = localStorage.getItem('adminSecret');
        try {
            await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/admin/clear-all`, {
                method: 'POST',
                headers: { 'Authorization': secret! }
            });
            fetchStats();
        } catch (err) {
            alert('Failed to reset server');
        }
    };

    if (loading) return <div className="lobby-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ color: 'white', fontSize: '1.5rem' }}>Loading...</div></div>;
    if (error) return <div className="lobby-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '20px' }}><div style={{ color: '#ff5555', fontSize: '1.2rem', textAlign: 'center' }}>{error}</div><button className="poker-button secondary" onClick={() => navigate('/admin')}>Back to Login</button></div>;

    return (
        <div className="lobby-container" style={{ overflowY: 'auto' }}>
            <div className="lobby-header">
                <h1 className="lobby-title">🛡️ Admin Dashboard</h1>
                <div className="chip-balance">
                    Uptime: {Math.floor(stats?.uptime || 0)}s
                </div>
            </div>

            <div className="player-profile" style={{ marginBottom: '20px' }}>
                <div className="profile-info">
                    <div className="profile-name">System Health</div>
                    <div className="profile-chips" style={{ fontSize: '0.9rem', color: '#ccc' }}>
                        Rooms: {stats?.rooms} | Players: {stats?.totalPlayers}
                    </div>
                </div>
                <button className="poker-button secondary" onClick={resetServer} style={{ background: '#d32f2f' }}>
                    ⚠️ Reset Server
                </button>
            </div>

            <div className="room-list">
                <h3>Active Rooms ({stats?.activeRooms.length})</h3>
                {stats?.activeRooms.map(room => (
                    <div key={room.id} className="room-item">
                        <div className="room-info">
                            <div className="room-name">{room.name}</div>
                            <div className="room-details">
                                ID: {room.id} | {room.players} Players | Phase: {room.phase}
                            </div>
                        </div>
                        <div className="room-action">
                            <button className="join-btn" onClick={() => deleteRoom(room.id)} style={{ background: '#d32f2f', minWidth: '80px' }}>
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
                {stats?.activeRooms.length === 0 && (
                    <div className="room-item" style={{ justifyContent: 'center', opacity: 0.5 }}>
                        No active rooms
                    </div>
                )}
            </div>

            <button className="poker-button secondary" onClick={() => navigate('/lobby')} style={{ marginTop: '20px' }}>
                Back to Lobby
            </button>
        </div>
    );
};

export default AdminDashboard;
