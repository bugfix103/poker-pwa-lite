import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Lobby.css'; // Reuse lobby styles for consistency

const AdminLogin: React.FC = () => {
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple client-side validation for UX, real check is on backend
        if (secret) {
            localStorage.setItem('adminSecret', secret);
            navigate('/admin/dashboard');
        } else {
            setError('Please enter the admin secret');
        }
    };

    return (
        <div className="lobby-container">
            <div className="lobby-card fade-in">
                <h1 className="lobby-title">🔒 Admin Access</h1>

                <form onSubmit={handleLogin} className="create-room-form">
                    <div className="form-group">
                        <label>Admin Secret Key</label>
                        <input
                            type="password"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            placeholder="Enter superuser key..."
                            className="poker-input"
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="lobby-actions">
                        <button type="button" className="poker-button secondary" onClick={() => navigate('/')}>
                            Back
                        </button>
                        <button type="submit" className="poker-button primary">
                            Login
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
