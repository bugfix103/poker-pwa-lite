import { Player, Room } from './types';
// @ts-ignore
import { Hand } from 'pokersolver';

export class BotLogic {
    static getAction(room: Room, bot: Player): { type: 'check' | 'call' | 'fold' | 'bet', amount?: number } {
        const currentBet = room.currentBet;
        const botBet = bot.currentBet;
        const callAmount = currentBet - botBet;
        const canCheck = callAmount === 0;

        // Basic Heuristic Logic

        // 1. If can check, mostly check (90%), sometimes small bet (10%)
        if (canCheck) {
            if (Math.random() > 0.9 && room.phase !== 'preflop') {
                return { type: 'bet', amount: room.settings.bigBlind };
            }
            return { type: 'check' };
        }

        // 2. If needs to call:
        //    - If "preflop" and cost is low (<= 2 big blinds), Call.
        //    - If cost is high relative to stack (> 20%), Fold unless pair+.
        //    - Randomize slightly to not be 100% predictable.

        const stackPercent = callAmount / bot.chips;

        // Always call small bets
        if (callAmount <= room.settings.bigBlind * 2) {
            return { type: 'call' };
        }

        // Analyze hand strength if we have cards
        if (bot.cards.length === 2) {
            try {
                const allCards = [...bot.cards, ...(room.communityCards || [])];
                const hand = Hand.solve(allCards);
                // Rank: 1=High Card, 2=Pair, 3=Two Pair, 4=Trips, 5=Straight, 6=Flush, 7=Full House, 8=Quads, 9=St.Flush

                // If we have at least a Pair (rank >= 2) or it's cheap, Call
                if (hand.rank >= 2) {
                    return { type: 'call' };
                }
            } catch (e) {
                console.error('Bot hand solve error:', e);
            }
        }

        // Random bluff/call (10% chance to call anyway)
        if (Math.random() < 0.1) {
            return { type: 'call' };
        }

        return { type: 'fold' };
    }
}
