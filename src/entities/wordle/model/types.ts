export type WordleStatus = 'PLAYING' | 'WON' | 'LOST';
export type WordleLetter = 'CORRECT' | 'PRESENT' | 'ABSENT' | 'UNSPECIFIED';

export interface WordleGuessDTO {
    word: string;
    letters: WordleLetter[];
}

export interface WordleDailyState {
    word_length: number;
    max_attempts: number;
    status: WordleStatus;
    guesses: WordleGuessDTO[];
    current_streak: number;
    target_word?: string;
}

export interface WordleGuessResult {
    status: WordleStatus;
    guess_result: WordleGuessDTO;
    current_streak: number;
    target_word?: string;
    promo_code?: string;
    promo_expires_at?: string;
    promo_discount_amount?: number;
}
