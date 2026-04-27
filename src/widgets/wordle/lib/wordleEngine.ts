export type TileColor = 'correct' | 'present' | 'absent';

export interface GuessResult {
    colors: TileColor[];
    isWin: boolean;
}

export const WORD_LENGTH = 5;
export const MAX_ROWS = 6;

export const scoreGuess = (guess: string, target: string): GuessResult => {
    const guessArr = guess.split('');
    const targetArr = target.split('');
    const colors: TileColor[] = Array(WORD_LENGTH).fill('absent');

    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guessArr[i] === targetArr[i]) {
            colors[i] = 'correct';
            targetArr[i] = '#';
        }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
        if (colors[i] === 'correct') continue;
        const idx = targetArr.indexOf(guessArr[i]);
        if (idx !== -1) {
            colors[i] = 'present';
            targetArr[idx] = '#';
        }
    }

    return { colors, isWin: guess === target };
};

export const isValidLetter = (key: string): boolean => /^[А-ЯЁ]$/.test(key);

export const createEmptyGrid = (): string[][] =>
    Array.from({ length: MAX_ROWS }, () => Array<string>(WORD_LENGTH).fill(''));
