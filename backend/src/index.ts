import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
// @ts-ignore - pokersolver doesn't have types
import { Hand } from 'pokersolver';
import { Player, Room, GAME_CONFIGS } from './types';
import { BotLogic } from './bot';
import authRouter from './auth';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Auth routes
app.use('/auth', authRouter);

// Constants
const STARTING_CHIPS = 10000;

const rooms: Map<string, Room> = new Map();
const turnTimers: Map<string, NodeJS.Timeout> = new Map(); // Track active turn timers

// Clear existing timer for a room
function clearTurnTimer(roomId: string) {
    const existingTimer = turnTimers.get(roomId);
    if (existingTimer) {
        clearTimeout(existingTimer);
        turnTimers.delete(roomId);
    }
}

// Start turn timer with auto-fold on expiry
function startTurnTimer(room: Room) {
    // Don't set timer for bots (they have their own delay) or during waiting/showdown
    if (room.phase === 'waiting' || room.phase === 'showdown') return;

    const currentPlayer = room.players[room.turnIndex];
    if (!currentPlayer || currentPlayer.isBot) return;

    clearTurnTimer(room.id);

    room.turnStartTime = Date.now();

    const timer = setTimeout(() => {
        // Auto-fold on timeout
        const roomNow = rooms.get(room.id);
        if (!roomNow) return;

        const player = roomNow.players[roomNow.turnIndex];
        if (!player || player.isBot) return;

        console.log(`⏰ [${room.id}] ${player.name} timed out - AUTO FOLD`);

        // Execute fold action
        executeGameAction(roomNow, player, { type: 'fold' });

    }, room.turnDuration * 1000);

    turnTimers.set(room.id, timer);
}

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

// Short Deck (6+) - no 2, 3, 4, 5 cards
const shortDeckValues = ['6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function createShortDeck(): string[] {
    const deck: string[] = [];
    for (const suit of suits) {
        for (const value of shortDeckValues) {
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
    const gameType = room.settings.gameType || 'holdem';
    const config = GAME_CONFIGS[gameType];

    if (activePlayers.length === 0) return null;
    if (activePlayers.length === 1) {
        return { winner: activePlayers[0], handName: 'Last player standing' };
    }

    const hands = activePlayers.map(player => {
        const allCards = [...player.cards, ...room.communityCards];
        let hand;

        // Use appropriate solver based on game type
        switch (config.solverType) {
            case 'omaha':
                hand = Hand.solve(allCards, 'omaha');
                break;
            case 'omahahilo':
                // For Hi-Lo, we'll use standard solver for high hand
                // TODO: implement split pot logic
                hand = Hand.solve(allCards, 'omaha');
                break;
            case 'threecard':
                hand = Hand.solve(player.cards, 'threecard');
                break;
            default:
                hand = Hand.solve(allCards);
        }
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

    const gameType = room.settings.gameType || 'holdem';
    const config = GAME_CONFIGS[gameType];

    // Create appropriate deck
    room.deck = config.deckType === 'shortdeck' ? createShortDeck() : createDeck();

    // Deal cards based on game type
    room.players.forEach(player => {
        player.cards = [];
        for (let i = 0; i < config.holeCards; i++) {
            player.cards.push(room.deck.pop()!);
        }
        player.folded = false;
        player.currentBet = 0;
        player.discardedCards = [];
    });

    room.communityCards = [];
    room.pot = 0;
    room.currentBet = 0;
    room.phase = config.hasDiscard ? 'draw' : 'preflop';
    room.winner = null;
    room.winningHand = null;
    room.drawPhaseComplete = false;

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



// Function to handle bot turns
function handleBotTurn(room: Room) {
    const currentPlayer = room.players[room.turnIndex];
    if (!currentPlayer || !currentPlayer.isBot || !currentPlayer.isTurn || room.phase === 'showdown' || room.phase === 'waiting') {
        return;
    }

    console.log(`🤖 [${room.id}] Bot ${currentPlayer.name} is thinking...`);

    // Delay 1.5s for realism
    setTimeout(() => {
        // Double check state hasn't changed (e.g. game ended, player left)
        if (room.players[room.turnIndex] !== currentPlayer) return;

        // Use BotLogic to decide
        // We need to re-import BotLogic inside implementation or ensure it's available. It is imported at top.
        // We need to pass a clone or ensure BotLogic doesn't mutate unexpectedly, but explicit values are safer.
        let action: { type: string, amount?: number } = { type: 'check' };

        try {
            // Need to fix imports in BotLogic to avoid circular deps if any, but currently one-way.
            // We'll just implement simple logic here if importing fails, but let's try to use the class.
            // Since we can't easily see if BotLogic import worked above without running, we assume it did.

            // Simple fallback logic if BotLogic is complex, but we'll try to use it
            action = BotLogic.getAction(room, currentPlayer);

        } catch (e) {
            console.error('Bot logic error, defaulting to check/fold', e);
            action = { type: 'fold' };
        }

        console.log(`🤖 [${room.id}] Bot ${currentPlayer.name} decides to: ${action.type}`);

        // Execute action (simulate socket event)
        // We can refactor `socket.on('action')` logic into a function `handlePlayerAction(room, player, action)`
        // But for now, let's just duplicate the crucial logic or expose it.
        // Refactoring is cleaner. Let's do that in a subsequent step. 
        // For now, I will implement a distinct `executeAction` function to share code.

        executeGameAction(room, currentPlayer, action);

    }, 1500);
}

function executeGameAction(room: Room, player: Player, data: { type: string; amount?: number }) {
    // Handle 'next' action for showdown phase separately
    if (data.type === 'next' && room.phase === 'showdown') {
        startNewRound(room);
        return;
    }

    if (room.phase === 'waiting' || room.phase === 'showdown') return;

    // Validate turn
    if (room.players[room.turnIndex].id !== player.id) {
        console.warn(`⚠️ Bot/Player ${player.name} tried to act out of turn`);
        return;
    }

    console.log(`🎯 [${room.id}] ${player.name} (Action): ${data.type}`);

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
                // Determine if we should fold or call instead if check is invalid (for bots)
                if (player.isBot) {
                    // Check invalid, force Fold
                    player.folded = true;
                } else {
                    // Should notify socket, but this is shared fn. 
                    // Since we can't emit to specific socket easily here without passing it, we just return.
                    return;
                }
            }
            break;
        case 'call':
            const toCall = room.currentBet - player.currentBet;
            if (toCall > 0) {
                // Handle all-in on call
                const actualCall = Math.min(toCall, player.chips);
                room.pot += actualCall;
                player.chips -= actualCall;
                player.currentBet += actualCall;
            }
            break;
        case 'bet':
        case 'raise':
            let amount = data.amount || room.settings.bigBlind;

            // Enforce minimum bet = big blind
            if (amount < room.settings.bigBlind) {
                amount = room.settings.bigBlind;
            }

            // Cap at player's remaining chips (all-in)
            const maxBet = player.chips;
            if (amount > maxBet) {
                amount = maxBet; // All-in
                console.log(`💰 [${room.id}] ${player.name} is ALL-IN for ${amount}!`);
            }

            // Validate player has positive chips
            if (amount <= 0) return;

            room.pot += amount;
            player.chips -= amount;
            player.currentBet += amount;
            room.currentBet = Math.max(room.currentBet, player.currentBet);
            room.lastRaiserIndex = room.players.indexOf(player);
            room.minActionsLeft = room.players.filter(p => !p.folded).length - 1;
            break;
    }

    if (data.type !== 'bet' && data.type !== 'raise') {
        room.minActionsLeft--;
    }

    // Move to next non-folded player
    do {
        room.players[room.turnIndex].isTurn = false;
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
    } while (room.players[room.turnIndex].folded);
    room.players[room.turnIndex].isTurn = true;

    // NEW Betting Round logic with all-in check
    const activeBettors = room.players.filter(p => !p.folded);
    const allMatched = activeBettors.every(p => p.currentBet === room.currentBet);

    // Check if players can still act (not all-in)
    const playersWhoCanAct = activeBettors.filter(p => p.chips > 0);
    const allInOrMatched = playersWhoCanAct.length <= 1 && allMatched;

    const roundComplete = (room.minActionsLeft <= 0 && allMatched) || allInOrMatched;

    if (roundComplete) {
        // If only one person can act or everyone is all-in, run cards to showdown
        if (playersWhoCanAct.length <= 1) {
            // Skip directly to showdown - deal remaining community cards
            while (room.communityCards.length < 5 && (room.phase as string) !== 'showdown') {
                advancePhase(room);
            }
        } else {
            advancePhase(room);
        }
    } else {
        // Start timer for next player's turn
        startTurnTimer(room);
        broadcastRoomState(room);
    }
}

function broadcastRoomState(room: Room) {
    room.players.forEach(player => {
        const socket = io.sockets.sockets.get(player.id);
        if (socket) {
            const isOwner = player.userId === room.ownerId;
            console.log(`📡 [${room.id}] Broadcasting to ${player.name}: userId=${player.userId}, ownerId=${room.ownerId}, isOwner=${isOwner}`);
            socket.emit('game_update', {
                roomId: room.id,
                ownerId: room.ownerId,
                isOwner: isOwner,
                players: room.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    chips: p.chips,
                    isDealer: p.isDealer,
                    isTurn: p.isTurn,
                    folded: p.folded,
                    currentBet: p.currentBet,
                    avatar: p.avatar,
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
                settings: room.settings,
                turnStartTime: room.turnStartTime,
                turnDuration: room.turnDuration,
                gameType: room.settings.gameType || 'holdem'
            });
        }
    });

    // Trigger bot if it's their turn
    handleBotTurn(room);

    // Start turn timer for human players
    startTurnTimer(room);
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
            phase: r.phase,
            gameType: r.settings.gameType || 'holdem'
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
            ownerId: data.userId || socket.id, // Use userId for persistent ownership
            lastRaiserIndex: 0,
            minActionsLeft: 0,
            turnDuration: 240, // 4 minutes per turn
            settings: {
                buyIn: data.settings?.buyIn || 1000,
                smallBlind: data.settings?.smallBlind || 5,
                bigBlind: data.settings?.bigBlind || 10,
                maxPlayers: data.settings?.maxPlayers || 6,
                roomName: data.settings?.roomName || `${data.name}'s Table`,
                gameType: data.settings?.gameType || 'holdem'
            }
        };
        rooms.set(roomId, room);
        console.log(`🏠 Room ${roomId} created by ${data.name} (ownerId: ${room.ownerId})`);

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

        console.log(`🔎 [Join Attempt] Name: ${name}, UserId: ${userId}, Room: ${roomId}`);
        console.log(`   Existing players: ${room.players.map(p => `${p.name} (${p.userId})`).join(', ')}`);

        if (existingPlayerIndex !== -1) {
            // Player exists - Reconnect them
            const player = room.players[existingPlayerIndex];

            // Owner check now uses userId, no need to transfer ownerId
            const isReconnectingOwner = player.userId === room.ownerId;
            if (isReconnectingOwner) {
                console.log(`👑 Owner ${player.name} (${player.userId}) reconnected`);
            }

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
        const room = currentRoom;

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        const player = room.players[playerIndex];

        // Use shared logic
        executeGameAction(room, player, data);
    });

    socket.on('add_bot', () => {
        if (!currentRoom) return;
        const room = currentRoom;

        // Find the player making the request
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Check if owner using userId
        if (room.ownerId !== player.userId) {
            socket.emit('error', { message: 'Only owner can add bots' });
            return;
        }

        if (room.players.length >= room.settings.maxPlayers) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const botName = `Bot ${['Mike', 'Sarah', 'John', 'Emma', 'Robot', 'Ace'][Math.floor(Math.random() * 6)]}`;

        const botPlayer: Player = {
            id: botId, // Pseudo socket ID
            userId: botId,
            name: botName,
            avatar: '🤖',
            chips: room.settings.buyIn,
            cards: [],
            isDealer: false, // Will be set by startNewRound if needed
            isTurn: false,
            folded: false,
            currentBet: 0,
            isBot: true
        };

        room.players.push(botPlayer);
        console.log(`🤖 ${botName} added to room ${room.id}`);

        io.to(room.id).emit('player_joined', {
            players: room.players.map(p => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                chips: p.chips,
                isDealer: p.isDealer,
                isTurn: p.isTurn
            })),
            newPlayer: botName,
            roomId: room.id
        });

        broadcastRoomState(room);
        io.emit('room_list_update');
    });

    socket.on('kick_player', (playerId: string) => {
        if (!currentRoom) return;

        // Find requester
        const requester = currentRoom.players.find(p => p.id === socket.id);
        if (!requester || requester.userId !== currentRoom.ownerId) return;

        // Find and remove the player from room
        const playerIndex = currentRoom.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            const kickedPlayer = currentRoom.players[playerIndex];
            currentRoom.players.splice(playerIndex, 1);
            console.log(`👢 ${kickedPlayer.name} was kicked from room ${currentRoom.id}`);

            // Notify kicked player
            const targetSocket = io.sockets.sockets.get(playerId);
            if (targetSocket) {
                targetSocket.emit('force_disconnect', { message: 'Kicked by owner' });
                targetSocket.leave(currentRoom.id);
            }

            // Broadcast updated state
            io.to(currentRoom.id).emit('player_left', { name: kickedPlayer.name });
            broadcastRoomState(currentRoom);
            io.emit('room_list_update');
        }
    });

    socket.on('delete_room', () => {
        if (!currentRoom) return;

        // Find requester
        const requester = currentRoom.players.find(p => p.id === socket.id);
        if (!requester || requester.userId !== currentRoom.ownerId) return;
        console.log(`🗑️ Room ${currentRoom.id} deleted by owner`);
        clearTurnTimer(currentRoom.id);
        io.to(currentRoom.id).emit('force_disconnect', { message: 'Room deleted by owner' });
        rooms.delete(currentRoom.id);
        io.emit('room_list_update');
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        if (currentRoom) {
            const playerIndex = currentRoom.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const leavingPlayer = currentRoom.players[playerIndex];
                const playerName = leavingPlayer.name;
                const wasOwner = currentRoom.ownerId === leavingPlayer.userId;

                currentRoom.players.splice(playerIndex, 1);
                io.to(currentRoom.id).emit('player_left', { name: playerName });

                // Transfer ownership if owner left and there are still players
                if (wasOwner && currentRoom.players.length > 0) {
                    // Find first non-bot player, or first bot if all are bots
                    const newOwner = currentRoom.players.find(p => !p.isBot) || currentRoom.players[0];
                    // Update owner to new player's userId (fallback to socket ID if no userId)
                    currentRoom.ownerId = newOwner.userId || newOwner.id;
                    console.log(`👑 Ownership of ${currentRoom.id} transferred to ${newOwner.name}`);
                }

                if (currentRoom.players.length < 2) {
                    currentRoom.phase = 'waiting';
                    clearTurnTimer(currentRoom.id);
                }

                broadcastRoomState(currentRoom);

                // Clean up empty rooms
                if (currentRoom.players.length === 0) {
                    clearTurnTimer(currentRoom.id);
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

// Admin Authentication Middleware
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

const authenticateAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (authHeader === ADMIN_SECRET) {
        next();
    } else {
        res.status(403).json({ error: 'Unauthorized: Invalid Admin Secret' });
    }
};

// Admin: Get Server Stats
app.get('/admin/stats', authenticateAdmin, (req, res) => {
    res.json({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        rooms: rooms.size,
        totalPlayers: Array.from(rooms.values()).reduce((sum, r) => sum + r.players.length, 0),
        activeRooms: Array.from(rooms.values()).map(r => ({
            id: r.id,
            name: r.settings.roomName,
            playerCount: r.players.length,
            players: r.players.map(p => ({
                name: p.name,
                userId: p.userId,
                socketId: p.id,
                chips: p.chips
            })),
            phase: r.phase,
            pot: r.pot
        }))
    });
});

// Admin: Clear all rooms
app.post('/admin/clear-all', authenticateAdmin, (req, res) => {
    const count = rooms.size;
    rooms.clear();
    io.emit('force_disconnect', { message: 'Server reset by admin' });
    console.log(`🧹 Cleared all ${count} rooms`);
    res.json({ success: true, cleared: count });
});

// Admin: Delete specific room
app.delete('/admin/rooms/:roomId', authenticateAdmin, (req, res) => {
    const roomId = (req.params.roomId as string).toUpperCase();
    const room = rooms.get(roomId);
    if (room) {
        io.to(roomId).emit('force_disconnect', { message: 'Room deleted by admin' });
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
