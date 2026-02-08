import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    console.log('🛡️ AdminDashboard component mounted');
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
            setError('');
        } catch (err) {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            setError(`Failed to connect to server at ${backendUrl}`);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
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

    const containerStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: '#121212',
        color: 'white',
        padding: '20px',
        maxWidth: '800px',
        margin: '0 auto'
    };

    const headerStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        background: 'rgba(30, 30, 30, 0.6)',
        padding: '15px 20px',
        borderRadius: '12px'
    };

    const cardStyle: React.CSSProperties = {
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
    };

    const buttonStyle: React.CSSProperties = {
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 'bold'
    };

    if (loading) {
        return (
            <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ ...containerStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <div style={{ color: '#ff5555', fontSize: '1.2rem', textAlign: 'center' }}>{error}</div>
                <button style={{ ...buttonStyle, background: 'rgba(255,255,255,0.1)', color: 'white' }} onClick={() => navigate('/admin')}>
                    Back to Login
                </button>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <div style={headerStyle}>
                <h1 style={{ margin: 0 }}>🛡️ Admin Dashboard</h1>
                <div style={{ color: '#4caf50' }}>Uptime: {Math.floor(stats?.uptime || 0)}s</div>
            </div>

            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: '0 0 10px 0' }}>System Health</h3>
                        <div style={{ color: '#aaa' }}>
                            Rooms: {stats?.rooms} | Players: {stats?.totalPlayers}
                        </div>
                    </div>
                    <button
                        style={{ ...buttonStyle, background: '#d32f2f', color: 'white' }}
                        onClick={resetServer}
                    >
                        ⚠️ Reset Server
                    </button>
                </div>
            </div>

            <div>
                <h3>Active Rooms ({stats?.activeRooms.length})</h3>
                {stats?.activeRooms.map(room => (
                    <div key={room.id} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{room.name}</div>
                                <div style={{ color: '#aaa', marginTop: '5px' }}>
                                    ID: {room.id} | {room.players} Players | Phase: {room.phase}
                                </div>
                            </div>
                            <button
                                style={{ ...buttonStyle, background: '#d32f2f', color: 'white' }}
                                onClick={() => deleteRoom(room.id)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
                {stats?.activeRooms.length === 0 && (
                    <div style={{ ...cardStyle, textAlign: 'center', opacity: 0.5 }}>
                        No active rooms
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                    style={{ ...buttonStyle, background: 'rgba(255,255,255,0.1)', color: 'white' }}
                    onClick={() => {
                        localStorage.removeItem('adminSecret');
                        navigate('/admin');
                    }}
                >
                    Logout Admin
                </button>
                <button
                    style={{ ...buttonStyle, background: '#bb86fc', color: '#000' }}
                    onClick={() => navigate('/lobby')}
                >
                    Go to Lobby
                </button>
            </div>
        </div>
    );
};

export default AdminDashboard;
