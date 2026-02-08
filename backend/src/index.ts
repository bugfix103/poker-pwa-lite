import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
// @ts-ignore - pokersolver doesn't have types
import { Hand } from 'pokersolver';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

// Constants
const STARTING_CHIPS = 1000;

// Room Management
interface Player {
    id: string;
    name: string;
    chips: number;
    cards: string[];
    isDealer: boolean;
    isTurn: boolean;
    folded: boolean;
    currentBet: number;
    avatar: string; // NEW: Emoji avatar
    userId: string; // NEW: Persistent ID
}

interface Room {
    id: string;
    players: Player[];
    pot: number;
    communityCards: string[];
    currentBet: number;
    phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
    dealerIndex: number;
    turnIndex: number;
    winner: string | null;
    winningHand: string | null;
    deck: string[];
    ownerId: string; // The person who can kick/delete
    lastRaiserIndex: number; // Who made the last raise
    minActionsLeft: number; // Ensure everyone acts at least once
    settings: {
        buyIn: number;
        smallBlind: number;
        bigBlind: number;
        maxPlayers: number;
        roomName: string;
    };
}

const rooms: Map<string, Room> = new Map();

// Generate 6-character room code
function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Card utilities
const suits = ['s', 'h', 'd', 'c'];
const suitSymbols: Record<string, string> = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
const values = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function createDeck(): string[] {
    const deck: string[] = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push(value + suit);
        }
    }
    return shuffle(deck);
}

function shuffle(array: string[]): string[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function toDisplayCard(card: string): string {
    const value = card[0] === 'T' ? '10' : card[0];
    const suit = suitSymbols[card[1]];
    return value + suit;
}

function determineWinner(room: Room): { winner: Player; handName: string } | null {
    const activePlayers = room.players.filter(p => !p.folded);

    if (activePlayers.length === 0) return null;
    if (activePlayers.length === 1) {
        return { winner: activePlayers[0], handName: 'Last player standing' };
    }

    const hands = activePlayers.map(player => {
        const allCards = [...player.cards, ...room.communityCards];
        const hand = Hand.solve(allCards);
        return { player, hand };
    });

    const handValues = hands.map(h => h.hand);
    const winners = Hand.winners(handValues);
    const winnerData = hands.find(h => winners.includes(h.hand));

    if (winnerData) {
        return { winner: winnerData.player, handName: winnerData.hand.name };
    }
    return null;
}

function startNewRound(room: Room) {
    console.log(`🎴 [${room.id}] Starting new round!`);
    room.deck = createDeck();

    // Reset players
    room.players.forEach(player => {
        player.cards = [room.deck.pop()!, room.deck.pop()!];
        player.folded = false;
        player.currentBet = 0;
    });

    room.communityCards = [];
    room.pot = 0;
    room.currentBet = 0;
    room.phase = 'preflop';
    room.winner = null;
    room.winningHand = null;

    // Set dealer
    room.dealerIndex = room.dealerIndex % room.players.length;

    // Post blinds
    const sbIndex = (room.dealerIndex + 1) % room.players.length;
    const bbIndex = (room.dealerIndex + 2) % room.players.length;

    const sbPlayer = room.players[sbIndex];
    const bbPlayer = room.players[bbIndex];

    const sb = room.settings.smallBlind;
    const bb = room.settings.bigBlind;

    sbPlayer.chips -= sb;
    sbPlayer.currentBet = sb;
    bbPlayer.chips -= bb;
    bbPlayer.currentBet = bb;

    room.pot = sb + bb;
    room.currentBet = bb;

    // First to act is after big blind
    room.turnIndex = (bbIndex + 1) % room.players.length;
    room.lastRaiserIndex = bbIndex; // BB is technically the last raiser
    room.minActionsLeft = room.players.length; // Everyone must act at least once

    room.players.forEach((p, i) => {
        p.isTurn = i === room.turnIndex;
        p.isDealer = i === room.dealerIndex;
    });

    broadcastRoomState(room);
}

function advancePhase(room: Room) {
    switch (room.phase) {
        case 'preflop':
            room.communityCards = [room.deck.pop()!, room.deck.pop()!, room.deck.pop()!];
            room.phase = 'flop';
            break;
        case 'flop':
            room.communityCards.push(room.deck.pop()!);
            room.phase = 'turn';
            break;
        case 'turn':
            room.communityCards.push(room.deck.pop()!);
            room.phase = 'river';
            break;
        case 'river':
            room.phase = 'showdown';
            const result = determineWinner(room);
            if (result) {
                room.winner = result.winner.name;
                room.winningHand = result.handName;
                result.winner.chips += room.pot;
                console.log(`🏆 [${room.id}] ${result.winner.name} wins with ${result.handName}! (+$${room.pot})`);
            }
            break;
        case 'showdown':
            room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
            startNewRound(room);
            return;
    }

    // Reset bets for new round
    room.players.forEach(p => p.currentBet = 0);
    room.currentBet = 0;

    // Reset turn - after dealer (SB acts first post-flop)
    room.turnIndex = (room.dealerIndex + 1) % room.players.length;
    while (room.players[room.turnIndex]?.folded) {
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
    }
    room.lastRaiserIndex = room.dealerIndex; // So it goes around at least once
    room.minActionsLeft = room.players.filter(p => !p.folded).length;

    room.players.forEach((p, i) => {
        p.isTurn = i === room.turnIndex && !p.folded;
    });

    console.log(`📍 [${room.id}] Phase: ${room.phase}, Community: ${room.communityCards.map(toDisplayCard).join(', ')}`);
    broadcastRoomState(room);
}

function broadcastRoomState(room: Room) {
    room.players.forEach(player => {
        const socket = io.sockets.sockets.get(player.id);
        if (socket) {
            socket.emit('game_update', {
                roomId: room.id,
                ownerId: room.ownerId,
                players: room.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    chips: p.chips,
                    isDealer: p.isDealer,
                    isTurn: p.isTurn,
                    folded: p.folded,
                    currentBet: p.currentBet,
                    cards: room.phase === 'showdown' ? p.cards.map(toDisplayCard) : undefined
                })),
                pot: room.pot,
                communityCards: room.communityCards.map(toDisplayCard),
                myCards: player.cards.map(toDisplayCard),
                phase: room.phase,
                currentBet: room.currentBet,
                status: getStatus(room),
                winner: room.winner,
                winningHand: room.winningHand,
                settings: room.settings // NEW
            });
        }
    });
}

function getStatus(room: Room): string {
    if (room.players.length < 2) {
        return `Waiting for players... (${room.players.length}/2) | Room: ${room.id}`;
    }
    if (room.phase === 'waiting') {
        return `🎮 Ready! Press START | Room: ${room.id}`;
    }
    if (room.phase === 'showdown') {
        if (room.winner) {
            return `🏆 ${room.winner} wins with ${room.winningHand}!`;
        }
        return '🏆 Showdown!';
    }
    const currentPlayer = room.players[room.turnIndex];
    if (!currentPlayer) return `Room: ${room.id} | ${room.phase.toUpperCase()}`;
    return `${currentPlayer.name}'s turn | Bet: $${room.currentBet} | ${room.phase.toUpperCase()}`;
}

// Socket handlers
io.on('connection', (socket: Socket) => {
    console.log('✅ User connected:', socket.id);
    let currentRoom: Room | null = null;

    socket.on('get_rooms', () => {
        const roomList = Array.from(rooms.values()).map(r => ({
            id: r.id,
            name: r.settings.roomName,
            players: r.players.length,
            maxPlayers: r.settings.maxPlayers,
            buyIn: r.settings.buyIn,
            blinds: `${r.settings.smallBlind}/${r.settings.bigBlind}`,
            phase: r.phase
        }));
        socket.emit('room_list', roomList);
    });

    socket.on('create_room', (data: { name: string; avatar: string; settings: any; userId?: string }) => {
        const roomId = generateRoomCode();
        const room: Room = {
            id: roomId,
            players: [],
            pot: 0,
            communityCards: [],
            currentBet: 0,
            phase: 'waiting',
            dealerIndex: 0,
            turnIndex: 0,
            winner: null,
            winningHand: null,
            deck: [],
            ownerId: socket.id,
            lastRaiserIndex: 0,
            minActionsLeft: 0,
            settings: {
                buyIn: data.settings?.buyIn || 1000,
                smallBlind: data.settings?.smallBlind || 5,
                bigBlind: data.settings?.bigBlind || 10,
                maxPlayers: data.settings?.maxPlayers || 6,
                roomName: data.settings?.roomName || `${data.name}'s Table`
            }
        };
        rooms.set(roomId, room);
        console.log(`🏠 Room ${roomId} created by ${data.name}`);

        socket.emit('room_created', { roomId });
        io.emit('room_list_update'); // Tell everyone in lobby to refresh
    });

    socket.on('join_room', ({ roomId, name, avatar, userId }: { roomId: string; name: string; avatar: string; userId: string }) => {
        const room = rooms.get(roomId.toUpperCase());
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Check for existing player by userId (Persistent Identity)
        const existingPlayerIndex = room.players.findIndex(p => p.userId === userId);

        if (existingPlayerIndex !== -1) {
            // Player exists - Reconnect them
            const player = room.players[existingPlayerIndex];

            // Update socket ID to new connection
            player.id = socket.id;
            player.name = name; // Update name if changed
            player.avatar = avatar || player.avatar;

            currentRoom = room;
            socket.join(roomId);

            console.log(`🔄 ${name} (User: ${userId}) reconnected to room ${roomId}`);

            // Send update immediately
            socket.emit('player_joined', {
                players: room.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    avatar: p.avatar,
                    chips: p.chips,
                    isDealer: p.isDealer,
                    isTurn: p.isTurn
                })),
                newPlayer: name,
                roomId
            });
            broadcastRoomState(room);
            io.emit('room_list_update');
            return;
        }

        if (room.players.length >= room.settings.maxPlayers) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        const newPlayer: Player = {
            id: socket.id,
            userId: userId || socket.id, // Fallback to socket ID if no userId
            name,
            avatar: avatar || '👤',
            chips: room.settings.buyIn,
            cards: [],
            isDealer: room.players.length === 0,
            isTurn: false,
            folded: false,
            currentBet: 0
        };

        room.players.push(newPlayer);
        currentRoom = room;
        socket.join(roomId);

        console.log(`👤 ${name} joined room ${roomId} (${room.players.length} players)`);

        io.to(roomId).emit('player_joined', {
            players: room.players.map(p => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                chips: p.chips,
                isDealer: p.isDealer,
                isTurn: p.isTurn
            })),
            newPlayer: name,
            roomId
        });

        broadcastRoomState(room);
        io.emit('room_list_update'); // Update player counts in lobby
    });

    socket.on('start_game', () => {
        if (!currentRoom) return;
        console.log(`🎲 [${currentRoom.id}] Start game requested`);
        if (currentRoom.players.length >= 2 && currentRoom.phase === 'waiting') {
            startNewRound(currentRoom);
        }
    });

    socket.on('action', (data: { type: string; amount?: number }) => {
        if (!currentRoom) return;
        const room = currentRoom; // Local reference to satisfy TypeScript

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        const player = room.players[playerIndex];

        if (room.phase === 'waiting') return;

        if (room.phase === 'showdown') {
            advancePhase(room);
            return;
        }

        console.log(`🎯 [${room.id}] ${player.name}: ${data.type}`);

        switch (data.type) {
            case 'fold':
                player.folded = true;
                const activePlayers = room.players.filter(p => !p.folded);
                if (activePlayers.length === 1) {
                    room.phase = 'showdown';
                    const result = determineWinner(room);
                    if (result) {
                        room.winner = result.winner.name;
                        room.winningHand = result.handName;
                        result.winner.chips += room.pot;
                    }
                    broadcastRoomState(room);
                    return;
                }
                break;
            case 'check':
                if (player.currentBet < room.currentBet) {
                    console.log(`⚠️ Invalid check by ${player.name}: Bet ${player.currentBet} < Room ${room.currentBet}`);
                    socket.emit('error', { message: 'Cannot check, must call or fold' });
                    return;
                }
                break;
            case 'call':
                const toCall = room.currentBet - player.currentBet;
                if (toCall > 0) {
                    room.pot += toCall;
                    player.chips -= toCall;
                    player.currentBet = room.currentBet;
                }
                break;
            case 'bet':
                const amount = data.amount || room.settings.bigBlind;
                room.pot += amount;
                player.chips -= amount;
                player.currentBet += amount;
                room.currentBet = player.currentBet;
                room.lastRaiserIndex = room.players.indexOf(player);
                room.minActionsLeft = room.players.filter(p => !p.folded).length - 1;
                break;
        }

        if (data.type !== 'bet') {
            room.minActionsLeft--;
        }

        // Move to next non-folded player
        do {
            room.players[room.turnIndex].isTurn = false;
            room.turnIndex = (room.turnIndex + 1) % room.players.length;
        } while (room.players[room.turnIndex].folded);
        room.players[room.turnIndex].isTurn = true;

        // NEW Betting Round logic
        const activeBettors = room.players.filter(p => !p.folded);
        const allMatched = activeBettors.every(p => p.currentBet === room.currentBet);
        const roundComplete = room.minActionsLeft <= 0 && allMatched;

        if (roundComplete) {
            advancePhase(room);
        } else {
            broadcastRoomState(room);
        }
    });

    socket.on('kick_player', (playerId: string) => {
        if (!currentRoom || currentRoom.ownerId !== socket.id) return;
        const targetSocket = io.sockets.sockets.get(playerId);
        if (targetSocket) {
            targetSocket.emit('force_disconnect', { message: 'Kicked by owner' });
            targetSocket.leave(currentRoom.id);
        }
    });

    socket.on('delete_room', () => {
        if (!currentRoom || currentRoom.ownerId !== socket.id) return;
        io.to(currentRoom.id).emit('force_disconnect', { message: 'Room deleted by owner' });
        rooms.delete(currentRoom.id);
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        if (currentRoom) {
            const playerIndex = currentRoom.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = currentRoom.players[playerIndex].name;
                currentRoom.players.splice(playerIndex, 1);
                io.to(currentRoom.id).emit('player_left', { name: playerName });

                if (currentRoom.players.length < 2) {
                    currentRoom.phase = 'waiting';
                }
                broadcastRoomState(currentRoom);

                // Clean up empty rooms
                if (currentRoom.players.length === 0) {
                    rooms.delete(currentRoom.id);
                    console.log(`🗑️ Room ${currentRoom.id} deleted (empty)`);
                }
            }
        }
    });
});

// API endpoints
app.get('/', (req, res) => {
    res.json({
        status: 'Poker PWA Lite Backend',
        rooms: rooms.size,
        totalPlayers: Array.from(rooms.values()).reduce((sum, r) => sum + r.players.length, 0)
    });
});

app.get('/rooms', (req, res) => {
    res.json(Array.from(rooms.entries()).map(([id, room]) => ({
        id,
        players: room.players.length,
        phase: room.phase
    })));
});

// Admin: Clear all rooms
app.post('/admin/clear-all', (req, res) => {
    const count = rooms.size;
    rooms.clear();
    io.emit('force_disconnect', { message: 'Server reset' });
    console.log(`🧹 Cleared all ${count} rooms`);
    res.json({ success: true, cleared: count });
});

// Admin: Delete specific room
app.delete('/rooms/:roomId', (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const room = rooms.get(roomId);
    if (room) {
        io.to(roomId).emit('force_disconnect', { message: 'Room deleted' });
        rooms.delete(roomId);
        console.log(`🗑️ Room ${roomId} deleted by admin`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🃏 Poker server running on port ${PORT}`);
});
