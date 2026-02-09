// All supported poker game types
export type GameType =
    | 'holdem'      // Texas Hold'em - 2 hole cards, 5 community
    | 'omaha'       // Omaha - 4 hole cards, 5 community
    | 'omaha_hilo'  // Omaha Hi-Lo - 4 hole cards, split pot
    | 'stud7'       // 7-Card Stud - 7 cards, no community
    | 'draw5'       // 5-Card Draw - 5 cards, discard/replace
    | 'shortdeck'   // Short Deck (6+) - 2 hole cards, no 2-5
    | 'threecard';  // 3-Card Poker - 3 cards, fast game

export interface RoomSettings {
    buyIn: number;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
    roomName: string;
    gameType: GameType;
}

export interface RoomInfo {
    id: string;
    name: string;
    players: number;
    maxPlayers: number;
    buyIn: number;
    blinds: string;
    phase: string;
    gameType: GameType;
}

export const AVATARS = [
    '👤', '🕵️', '🤠', '👽', '🤖', '🐯', 'aaa', '🐶', '🦊',
    '🦁', '🦄', '🐲', '🧙‍♂️', '🥷', '🧟', '🧛‍♀️', '🧞‍♂️', '🧚‍♀️'
];

export const DEFAULT_SETTINGS: RoomSettings = {
    buyIn: 1000,
    smallBlind: 5,
    bigBlind: 10,
    maxPlayers: 6,
    roomName: '',
    gameType: 'holdem'
};

// Labels for UI display
export const GAME_TYPE_LABELS: Record<GameType, string> = {
    holdem: "Texas Hold'em",
    omaha: 'Omaha',
    omaha_hilo: 'Omaha Hi-Lo',
    stud7: '7-Card Stud',
    draw5: '5-Card Draw',
    shortdeck: 'Short Deck (6+)',
    threecard: '3-Card Poker'
};

// Card counts for each game type (for UI display)
export const GAME_HOLE_CARDS: Record<GameType, number> = {
    holdem: 2,
    omaha: 4,
    omaha_hilo: 4,
    stud7: 7,
    draw5: 5,
    shortdeck: 2,
    threecard: 3
};
