/** correct - буква на своём месте, present - есть в слове не на этом месте, absent - нет. */
export type TileColor = 'correct' | 'present' | 'absent';

export interface GuessResult {
    /** Цвета плиток по позициям догадки. */
    colors: TileColor[];
    /** Полное совпадение догадки с загаданным словом. */
    isWin: boolean;
}

/** Количество букв в одном слове. */
export const WORD_LENGTH = 5;
/** Максимальное число попыток на партию. */
export const MAX_ROWS = 6;

// Раскраска плиток: сначала точные совпадения (буква цели замещается заглушкой,
// чтобы не учитываться повторно), затем оставшиеся позиции - на присутствие в цели.
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

/** Является ли строка одной русской заглавной буквой. */
export const isValidLetter = (key: string): boolean => /^[А-ЯЁ]$/.test(key);

/** Пустая игровая сетка: MAX_ROWS рядов по WORD_LENGTH пустых ячеек. */
export const createEmptyGrid = (): string[][] =>
    Array.from({ length: MAX_ROWS }, () => Array<string>(WORD_LENGTH).fill(''));
