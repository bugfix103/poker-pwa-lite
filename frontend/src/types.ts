export interface RoomSettings {
    buyIn: number;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
    roomName: string;
}

export interface RoomInfo {
    id: string;
    name: string;
    players: number;
    maxPlayers: number;
    buyIn: number;
    blinds: string;
    phase: string;
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
    roomName: ''
};
