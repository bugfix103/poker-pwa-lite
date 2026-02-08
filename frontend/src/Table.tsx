import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from './Login';
import './Table.css';

interface Player {
    id: string;
    name: string;
    chips: number;
    cards?: string[];
    isDealer?: boolean;
    isTurn?: boolean;
    folded?: boolean;
    currentBet?: number;
    avatar?: string;
}

function Table() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [pot, setPot] = useState(0);
    const [communityCards, setCommunityCards] = useState<string[]>([]);
    const [myCards, setMyCards] = useState<string[]>([]);
    const [betAmount, setBetAmount] = useState(10);
    const [gameStatus, setGameStatus] = useState('Waiting for players...');
    const [phase, setPhase] = useState('waiting');
    const [winner, setWinner] = useState<string | null>(null);
    const [winningHand, setWinningHand] = useState<string | null>(null);
    const [currentBet, setCurrentBet] = useState(0);
    const [roomId, setRoomId] = useState(localStorage.getItem('poker_room') || '');
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const navigate = useNavigate();

    const username = localStorage.getItem('poker_username') || 'Guest';

    useEffect(() => {
        // Re-join room on page refresh
        const savedRoom = localStorage.getItem('poker_room');
        const savedName = localStorage.getItem('poker_username');
        if (savedRoom && savedName) {
            const savedAvatar = localStorage.getItem('poker_avatar') || '👤';
            const userId = localStorage.getItem('poker_user_id') || 'unknown'; // Should be generated in Login/utils
            socket.emit('join_room', { roomId: savedRoom, name: savedName, avatar: savedAvatar, userId });
        }

        socket.on('game_update', (data) => {
            console.log('Game update:', data);
            if (data.players) setPlayers(data.players);
            if (data.pot !== undefined) setPot(data.pot);
            if (data.communityCards) setCommunityCards(data.communityCards);
            if (data.myCards) setMyCards(data.myCards);
            if (data.status) setGameStatus(data.status);
            if (data.phase) setPhase(data.phase);
            if (data.currentBet !== undefined) setCurrentBet(data.currentBet);
            if (data.roomId) setRoomId(data.roomId);
            if (data.ownerId) setOwnerId(data.ownerId);
            setWinner(data.winner || null);
            setWinningHand(data.winningHand || null);
        });

        socket.on('player_joined', (data) => {
            setPlayers(data.players);
            if (data.roomId) setRoomId(data.roomId);
            setGameStatus(`${data.newPlayer} joined!`);
        });

        socket.on('player_left', (data) => {
            setGameStatus(`${data.name} left the game`);
        });

        socket.on('force_disconnect', (data) => {
            alert(data?.message || 'Disconnected from room');
            localStorage.removeItem('poker_room');
            navigate('/');
        });

        socket.on('error', (err: { message: string }) => {
            console.error('Socket error:', err);
            alert(err.message || 'An error occurred');
            if (err.message === 'Room not found' || err.message === 'Room is full') {
                localStorage.removeItem('poker_room');
                navigate('/lobby');
            }
        });

        return () => {
            socket.off('game_update');
            socket.off('player_joined');
            socket.off('player_left');
            socket.off('force_disconnect');
            socket.off('error');
        };
    }, [navigate]);

    const handleStartGame = () => socket.emit('start_game');
    const handleFold = () => socket.emit('action', { type: 'fold' });
    const handleCheck = () => socket.emit('action', { type: 'check' });
    const handleCall = () => socket.emit('action', { type: 'call' });
    const handleBet = () => socket.emit('action', { type: 'bet', amount: betAmount });
    const handleNextRound = () => socket.emit('action', { type: 'next' });

    const handleLeaveRoom = () => {
        localStorage.removeItem('poker_room');
        socket.disconnect();
        socket.connect();
        navigate('/');
    };

    const handleKick = (playerId: string) => {
        if (window.confirm('Kick this player?')) {
            socket.emit('kick_player', playerId);
        }
    };

    const handleDeleteRoom = () => {
        if (window.confirm('Delete this room and kick everyone?')) {
            socket.emit('delete_room');
        }
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomId);
        setGameStatus(`Room code ${roomId} copied!`);
    };

    const renderCard = (card: string, index: number) => {
        const isRed = card.includes('♥') || card.includes('♦');
        return (
            <div key={index} className={`card ${isRed ? 'red' : 'black'}`}>
                {card}
            </div>
        );
    };

    // Find current player's bet status
    const myPlayer = players.find(p => p.name === username);
    const myCurrentBet = myPlayer?.currentBet || 0;
    const toCall = currentBet - myCurrentBet;
    const canCheck = toCall === 0;
    const isOwner = socket.id === ownerId;

    return (
        <div className="table-container">
            {/* Header */}
            <div className="header">
                <span className="player-name">👤 {username}</span>
                <button className="room-code" onClick={copyRoomCode} title="Click to copy">
                    🔗 {roomId}
                </button>
                <div className={`table-connection ${socket.connected ? 'connected' : 'disconnected'}`} title={socket.connected ? 'Connected' : 'Disconnected'}>
                    {socket.connected ? '🟢' : '🔴'}
                </div>
                <span className="pot">💰 ${pot}</span>
                <div className="header-actions">
                    {isOwner && (
                        <button className="delete-btn" onClick={handleDeleteRoom} title="Delete Room">
                            🗑️
                        </button>
                    )}
                    <button className="leave-btn" onClick={handleLeaveRoom} title="Leave Room">
                        🚪
                    </button>
                </div>
            </div>

            {/* Game Status */}
            <div className={`status-bar ${winner ? 'winner' : ''}`}>{gameStatus}</div>

            {/* Winner Banner */}
            {winner && (
                <div className="winner-banner">
                    🏆 {winner} wins with {winningHand}!
                </div>
            )}

            {/* Poker Table */}
            <div className="poker-table">
                {/* Community Cards */}
                <div className="community-cards">
                    {communityCards.length > 0
                        ? communityCards.map(renderCard)
                        : <span className="waiting-text">Community cards appear here</span>
                    }
                </div>

                {/* Player Seats */}
                <div className="seats">
                    {players.length > 0 ? (
                        players.map((player, i) => (
                            <div
                                key={player.id}
                                className={`seat seat-${i + 1} ${player.isTurn ? 'active' : ''} ${player.folded ? 'folded' : ''}`}
                            >
                                <div className="seat-avatar">
                                    {player.avatar || '👤'}
                                    {isOwner && player.id !== socket.id && (
                                        <button
                                            className="kick-badge"
                                            onClick={(e) => { e.stopPropagation(); handleKick(player.id); }}
                                            title="Kick Player"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                <div className="seat-name">
                                    {player.name}
                                    {player.isDealer && <span className="dealer-button">D</span>}
                                </div>
                                <div className="seat-chips">${player.chips}</div>
                                {player.currentBet !== undefined && player.currentBet > 0 && (
                                    <div className="seat-bet">Bet: ${player.currentBet}</div>
                                )}
                                {player.folded && <div className="folded-badge">FOLD</div>}
                                {phase === 'showdown' && player.cards && (
                                    <div className="player-cards">
                                        {player.cards.map((c, idx) => (
                                            <span key={idx} className={`mini-card ${c.includes('♥') || c.includes('♦') ? 'red' : ''}`}>
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="empty-seats">
                            <p>No players yet</p>
                            <p className="hint">Share room code: <strong>{roomId}</strong></p>
                        </div>
                    )}
                </div>
            </div>

            {/* My Cards */}
            <div className="my-cards">
                <span className="label">Your Cards:</span>
                <div className="cards-container">
                    {myCards.length > 0
                        ? myCards.map(renderCard)
                        : <>
                            <div className="card face-down">🂠</div>
                            <div className="card face-down">🂠</div>
                        </>
                    }
                </div>
            </div>

            {/* Action Controls */}
            <div className="controls">
                {phase === 'waiting' && players.length >= 2 ? (
                    <button className="btn start-game" onClick={handleStartGame}>
                        🎮 START GAME
                    </button>
                ) : phase === 'showdown' ? (
                    <button className="btn start-game" onClick={handleNextRound}>
                        🔄 NEXT ROUND
                    </button>
                ) : (
                    <>
                        <div className="bet-slider">
                            <input
                                type="range"
                                min="10"
                                max={myPlayer?.chips || 1000}
                                step="10"
                                value={betAmount}
                                onChange={(e) => setBetAmount(Number(e.target.value))}
                            />
                            <span className="bet-amount">${betAmount}</span>
                        </div>
                        <div className="action-buttons">
                            <button className="btn fold" onClick={handleFold}>Fold</button>
                            {canCheck ? (
                                <button className="btn check" onClick={handleCheck}>Check</button>
                            ) : (
                                <button className="btn call" onClick={handleCall}>
                                    Call ${toCall}
                                </button>
                            )}
                            <button className="btn raise" onClick={handleBet}>
                                {currentBet > 0 ? `Raise $${betAmount}` : `Bet $${betAmount}`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Table;
