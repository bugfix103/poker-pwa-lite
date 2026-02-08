export interface Player {
    id: string;
    userId: string;
    name: string;
    avatar: string;
    chips: number;
    cards: string[];
    isDealer: boolean;
    isTurn: boolean;
    folded: boolean;
    currentBet: number;
    isBot?: boolean; // Added for Bot integration
}

export interface RoomSettings {
    buyIn: number;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
    roomName: string;
}

export interface Room {
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
    ownerId: string;
    lastRaiserIndex: number;
    minActionsLeft: number;
    settings: RoomSettings;
}
