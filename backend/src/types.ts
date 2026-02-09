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
    isBot?: boolean;
    discardedCards?: string[]; // For 5-Card Draw
}

// All supported poker game types
export type GameType =
    | 'holdem'      // Texas Hold'em - 2 hole cards, 5 community
    | 'omaha'       // Omaha - 4 hole cards, 5 community
    | 'omaha_hilo'  // Omaha Hi-Lo - 4 hole cards, split pot
    | 'stud7'       // 7-Card Stud - 7 cards, no community
    | 'draw5'       // 5-Card Draw - 5 cards, discard/replace
    | 'shortdeck'   // Short Deck (6+) - 2 hole cards, no 2-5
    | 'threecard';  // 3-Card Poker - 3 cards, fast game

// Game configuration for each variant
export interface GameConfig {
    holeCards: number;
    communityCards: number;
    solverType: string;
    hasDiscard: boolean;
    deckType: 'standard' | 'shortdeck';
    description: string;
}

export const GAME_CONFIGS: Record<GameType, GameConfig> = {
    holdem: {
        holeCards: 2,
        communityCards: 5,
        solverType: 'standard',
        hasDiscard: false,
        deckType: 'standard',
        description: "Texas Hold'em - 2 cards, 5 community"
    },
    omaha: {
        holeCards: 4,
        communityCards: 5,
        solverType: 'omaha',
        hasDiscard: false,
        deckType: 'standard',
        description: "Omaha - 4 cards, must use exactly 2"
    },
    omaha_hilo: {
        holeCards: 4,
        communityCards: 5,
        solverType: 'omahahilo',
        hasDiscard: false,
        deckType: 'standard',
        description: "Omaha Hi-Lo - Split pot high/low"
    },
    stud7: {
        holeCards: 7,
        communityCards: 0,
        solverType: 'standard',
        hasDiscard: false,
        deckType: 'standard',
        description: "7-Card Stud - 7 cards, no community"
    },
    draw5: {
        holeCards: 5,
        communityCards: 0,
        solverType: 'standard',
        hasDiscard: true,
        deckType: 'standard',
        description: "5-Card Draw - Discard and replace"
    },
    shortdeck: {
        holeCards: 2,
        communityCards: 5,
        solverType: 'standard',
        hasDiscard: false,
        deckType: 'shortdeck',
        description: "Short Deck (6+) - No 2-5 cards"
    },
    threecard: {
        holeCards: 3,
        communityCards: 0,
        solverType: 'threecard',
        hasDiscard: false,
        deckType: 'standard',
        description: "3-Card Poker - Fast casino style"
    }
};

export interface RoomSettings {
    buyIn: number;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
    roomName: string;
    gameType: GameType;
}

export interface Room {
    id: string;
    players: Player[];
    pot: number;
    communityCards: string[];
    currentBet: number;
    phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'draw';
    dealerIndex: number;
    turnIndex: number;
    winner: string | null;
    winningHand: string | null;
    deck: string[];
    ownerId: string;
    lastRaiserIndex: number;
    minActionsLeft: number;
    settings: RoomSettings;
    turnStartTime?: number;
    turnDuration: number;
    drawPhaseComplete?: boolean; // For 5-Card Draw
}
