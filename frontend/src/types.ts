export type GameType = 'holdem' | 'omaha';

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

export const GAME_TYPE_LABELS: Record<GameType, string> = {
    holdem: "Texas Hold'em",
    omaha: 'Omaha'
};
