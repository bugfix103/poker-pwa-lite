import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Lobby.css';

const AdminLogin: React.FC = () => {
    console.log('🔐 AdminLogin component mounted');
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (secret) {
            localStorage.setItem('adminSecret', secret);
            navigate('/admin/dashboard');
        } else {
            setError('Please enter the admin secret');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#121212',
            color: 'white',
            padding: '20px'
        }}>
            <div style={{
                background: 'rgba(30, 30, 30, 0.95)',
                padding: '40px',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '400px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}>
                <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>🔒 Admin Access</h1>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Admin Secret Key</label>
                        <input
                            type="password"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            placeholder="Enter superuser key..."
                            style={{
                                width: '100%',
                                padding: '12px 15px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                fontSize: '1rem',
                                marginTop: '8px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(244,67,54,0.2)',
                            color: '#ff5555',
                            padding: '10px 15px',
                            borderRadius: '8px',
                            marginBottom: '15px'
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            style={{
                                flex: 1,
                                padding: '12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'rgba(255,255,255,0.1)',
                                color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1,
                                padding: '12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#bb86fc',
                                color: '#000',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Login
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
